const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { checkGame, forceStartVoting } = require("../gameManager.js");

// generate images with Prodia
module.exports.execute = execute = async (prodia, interaction) => {
  // check if there is a game running in the current channel & if the user can participate
  const runningGame = checkGame(interaction.channelId);
  const participatingInGame = (
    runningGame &&
    !runningGame.voting &&
    !runningGame.optedOut.includes(interaction.user.id) &&
    !runningGame.submissions.some(submission => submission.author === interaction.user.id)
  );
  
  await interaction.deferReply({ ephemeral: participatingInGame });

  let job;
  
  try {
    // generate the image
    job = await prodia.generate({
      model: interaction.options.getString("model") ?? undefined,
      prompt: interaction.options.getString("prompt", true),
      negative_prompt: interaction.options.getString("negative_prompt") ?? undefined,
      steps: interaction.options.getNumber("steps") ?? undefined,
      cfg_scale: interaction.options.getNumber("cfg_scale") ?? undefined,
      seed: interaction.options.getNumber("seed") ?? undefined,
      upscale: interaction.options.getBoolean("upscale") ?? undefined,
      scaler: interaction.options.getString("sampler") ?? undefined,
      aspect_ratio: interaction.options.getString("aspect_ratio") ?? undefined,
    });
  } catch (error) {
    await interaction.followUp({
      content: "I wasn't able to generate that image. Please make sure your parameters are valid and try again."
    });
    return;
  }

  const { imageUrl, status } = await prodia.wait(job);

  // create buttons to submit/leave if participating in the game
  const components = [];

  if (participatingInGame) {
    const submit = new ButtonBuilder()
      .setCustomId("submitGeneration")
      .setLabel("Submit Generation")
      .setStyle(ButtonStyle.Primary);

    const leaveGame = new ButtonBuilder()
      .setCustomId("leaveGame")
      .setLabel("Leave Game")
      .setStyle(ButtonStyle.Secondary);
      
    components.push(
      new ActionRowBuilder()
        .addComponents(submit, leaveGame)
    );
  }

  // send response with generated image (and info about the game, if the user is in one)
  const response = await interaction.followUp({
    content: participatingInGame ? `There's a game running in this channel! If you want to use this generation for the current game with the theme **${runningGame.topic}**, you can submit it. Alternatively, you can keep generating images until it's the best you can make it. If you don't want to partake in this game, you can also leave the game without submitting an image.` : undefined,
    files: [
      { attachment: imageUrl }
    ],
    components
  });

  // listen for button clicks if they exist
  if (components.length >= 1) {
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 1000*60*5 // collect for 5 minutes
    });

    collector.on("collect", async (i) => {
      // make sure the user's state hasn't changed since first running it 
      if (
        runningGame.ended ||
        runningGame.optedOut.includes(interaction.user.id)
      ) {
        await i.reply({
          content: (
            runningGame.ended ?
            "Sorry! That game has already ended!" :
            "Sorry! You can't interact with a game that you've already left."
          ),
          ephemeral: true
        });
        await stopCollector();
        return;
      }

      const rowComponents = components[0].components;
      
      const submitIndex = rowComponents.findIndex(b => b.data.custom_id === "submitGeneration");
      const leaveIndex = rowComponents.findIndex(b => b.data.custom_id === "leaveGame");
      
      switch (i.customId) {
        case "submitGeneration":
          // again checking to make sure user's state hasn't changed
          const stillParticipatingInGame = (
            runningGame &&
            runningGame.submissions.length < 10 &&
            !runningGame.voting &&
            !runningGame.optedOut.includes(interaction.user.id) &&
            !runningGame.submissions.some(submission => submission.author === interaction.user.id)
          );

          if (!stillParticipatingInGame) {
            await i.reply({ content: "You can no longer submit images for that game.", ephemeral: true });
            await stopCollector();
            return;
          }

          // push it to the submissions array so that the submission can be read elsewhere
          runningGame.submissions.push({
            author: interaction.user.id,
            url: imageUrl,
            votes: [],
          });

          rowComponents[submitIndex].setEmoji("✅");
          rowComponents[submitIndex].setLabel("Submitted Generation");
          rowComponents.splice(leaveIndex, 1);
          
          await stopCollector(i);

          // no more than 10 submissions for a given game
          if (runningGame.submissions.length >= 10)
            await forceStartVoting(interaction.channelId);
          
          break;
        case "leaveGame":
          runningGame.optedOut.push(interaction.user.id);

          rowComponents[leaveIndex].setEmoji("✅");
          rowComponents[leaveIndex].setLabel("Left Game");
          rowComponents.splice(submitIndex, 1);
          
          await stopCollector(i);
          
          break;
        default:
          throw new Error("Unknown interaction");
      }

      async function stopCollector(buttonInteraction) {
        collector.stop();
        await disableButtons(buttonInteraction);
      }
    });

    collector.on("end", async () => await disableButtons());

    // disable all buttons (when submitted, left, timed out, etc.)
    async function disableButtons(buttonInteraction) {
      for (const row of components)
        for (const component of row.components)
          component.setDisabled(true);
      
      if (buttonInteraction)
        await buttonInteraction.update({ components });
      else
        await interaction.editReply({ components });
    }
  }
};

module.exports.autocomplete = autocomplete = async (prodia, interaction) => {
  const focused = interaction.options.getFocused(true);

  if (focused.name !== "model") return console.error(`Unknown option ${focused.name}`);

  // get the current input for the model option
  const focusedValue = focused.value;

  // get the list of available Prodia models
  const choices = await prodia.listModels();

  // filter the models based on the input and ensure the list is no longer than 25 (Discord does not accept more than 25 results)
  const filtered = choices
    .filter(choice => choice.startsWith(focusedValue))
    .slice(0, 25);

  // map the list to the correct format and send the autocomplete list
  const mapped = filtered.map(choice => ({ name: choice, value: choice }));
  await interaction.respond(mapped);
};

module.exports.data = new SlashCommandBuilder()
  .setName("generate")
  .setDescription("Generate an image using Prodia")
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName("prompt")
      .setDescription("Image Prompt")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("model")
      .setDescription("Model")
      .setAutocomplete(true)
  )
  .addStringOption((option) =>
    option
      .setName("negative_prompt")
      .setDescription("Negative Image Prompt")
  )
  .addNumberOption((option) =>
    option
      .setName("steps")
      .setDescription("Steps")
  )
  .addNumberOption((option) =>
    option
      .setName("cfg_scale")
      .setDescription("CFG Scale")
  )
  .addNumberOption((option) =>
    option
      .setName("seed")
      .setDescription("Seed")
  )
  .addBooleanOption((option) =>
    option
      .setName("upscale")
      .setDescription("Enable 2x Upscale")
  )
  .addStringOption((option) =>
    option
      .setName("sampler")
      .setDescription("Sampler")
      .addChoices(
        { name: "Euler a", value: "Euler a" },
        { name: "LMS", value: "LMS" },
        { name: "Heun", value: "Heun" },
        { name: "DPM2", value: "DPM2" },
        { name: "DPM2 a", value: "DPM2 a" },
        { name: "DPM++ 2S a", value: "DPM++ 2S a" },
        { name: "DPM++ 2M", value: "DPM++ 2M" },
        { name: "DPM++ SDE", value: "DPM++ SDE" },
        { name: "DPM fast", value: "DPM fast" },
        { name: "DPM adaptive", value: "DPM adaptive" },
        { name: "LMS Karras", value: "LMS Karras" },
        { name: "DPM2 Karras", value: "DPM2 Karras" },
        { name: "DPM2 a Karras", value: "DPM2 a Karras" },
        { name: "DPM++ 2S a Karras", value: "DPM++ 2S a Karras" },
        { name: "DPM++ 2M Karras", value: "DPM++ 2M Karras" },
        { name: "DPM++ SDE Karras", value: "DPM++ SDE Karras" },
        { name: "DDIM", value: "DDIM" },
        { name: "PLMS", value: "PLMS" },
      )
  )
  .addStringOption((option) =>
    option
      .setName("aspect_ratio")
      .setDescription("Aspect Ratio")
      .addChoices(
        { name: "square", value: "square" },
        { name: "portrait", value: "portrait" },
        { name: "landscape", value: "landscape" },
      )
  );
