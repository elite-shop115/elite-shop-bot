const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require("discord.js");
const gameTopics = require("../gameTopics.json");
const { startGame, checkGame, finishGame } = require("../gameManager.js");
const modifyImage = require("../modifyImage");

// start a image generation game
module.exports.execute = execute = async (prodia, interaction) => {
  // color used for embeds
  const embedColor = "#FFD500";

  // make sure it's the only game running in the channel (max 1 per channel)
  const runningGame = checkGame(interaction.channelId);
  
  if (runningGame) return await interaction.reply({
    content: `A game is already being run in this channel! Its topic is **${runningGame.topic}**. You can start a game after the current game is over.`,
    ephemeral: true,
  });

  // get the topic of the game
  const gameTopic = interaction.options.getString("topic") ?? gameTopics[getRandomInt(0, gameTopics.length)];

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${interaction.member.displayName} has started a new game!`,
      iconURL: interaction.member.displayAvatarURL()
    })
    .setTitle(`Topic: ${gameTopic}`)
    .setDescription(`Generate images in this channel under the topic **${gameTopic}** using the \`/generate\` command and select your best image generation. After 5 minutes, everyone can vote on their favorite image to select a winner!`)
    .setColor(embedColor);

  const gameTime = 1000*60*5; // game end after 5 minutes
  
  const timeout = setTimeout(startVoting, gameTime); // games end after 5 minutes
  const minuteTimeout = setTimeout(sendWarning, gameTime-1000*60*1); // send warning 1 minute before ending
  
  const game = startGame(interaction.channelId, gameTopic, startVoting, [timeout, minuteTimeout]);

  // reply with the initial topic embed
  const message = await interaction.reply({
    embeds: [embed],
    fetchReply: true,
  });

  async function sendWarning() {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`The game is about to end!`)
        .setDescription(`This channel's game with the topic of **${gameTopic}** is going to end in 1 minute! Be sure to submit your image generations now so that they can be included in the voting!`)
        .setColor(embedColor);

      await message.reply({ embeds: [ embed ] });
    } catch (error) {
      console.log(error);
    }
  }
  
  async function startVoting() {
    try {
      game.voting = true;
  
      if (game.submissions.length < 2) {
        finishGame(interaction.channelId);
        await message.reply({
          content: "Not enough images were submitted for this game! At least 2 images must be submitted in order to vote. If you'd like to try it again, feel free to start another game!"
        });
        return;
      }
      
      const embed = new EmbedBuilder()
        .setTitle("Voting time!")
        .setDescription(`This game has now ended! Let's vote on a winner!\nWhich image do you think best represents the topic of **${gameTopic}**? Be sure to click each image to view the entire image.
  
  I'll send the winner after 1 minute!`)
        .setColor(embedColor);
  
      // emojis for the buttons
      const emojis = [
        "1️⃣",
        "2️⃣",
        "3️⃣",
        "4️⃣",
        "5️⃣",
        "6️⃣",
        "7️⃣",
        "8️⃣",
        "9️⃣",
        "🔟",
      ];
      
      const files = [];
      const components = [ new ActionRowBuilder() ];
      let currentRowIndex = 0;
      for (let i = 0; i < game.submissions.length; i++) {
        const submission = game.submissions[i];
        const buffer = await modifyImage(submission.url, i+1);
        const attachment = new AttachmentBuilder(buffer);
  
        // push manipulated image to array
        files.push(attachment);
        
        const submit = new ButtonBuilder()
          .setCustomId(`vote_${i}`)
          .setLabel(`Vote for ${i+1}`)
          .setEmoji(emojis[i])
          .setStyle(ButtonStyle.Primary);
        
        if (components[currentRowIndex].components.length === 5) {
          components.push(new ActionRowBuilder());
          currentRowIndex++;
        }
        
        components[currentRowIndex].addComponents(submit);
      }
      
      // reply with the voting embed
      const response = await message.reply({
        embeds: [embed],
        files,
        components,
      });
  
      // listen for user to select their vote
      
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 1000*60*1 // collect for 1 minute
      });
  
      collector.on("collect", async (i) => {
        const id = i.customId;
        const votedFor = Number(id.split("_")[1]); // parse the custom ID to get the index of the submission
  
        if (game.submissions.some(sub => sub.votes.includes(i.user.id)))
          return await i.reply({ content: "You can't vote twice!", ephemeral: true });
        
        if (game.submissions[votedFor].author === i.user.id)
          return await i.reply({ content: "You can't vote for your own image!", ephemeral: true });
  
        game.submissions[votedFor].votes.push(i.user.id);
  
        await i.reply({ content: `Your vote for #${votedFor+1} has been submitted!`, ephemeral: true });
      });
  
      collector.on("end", async () => {
        for (const row of components)
          for (const component of row.components)
            component.setDisabled(true);
        await response.edit({ components });
        
        let winners = [];
        
        // there may be a tie
        for (const submission of game.submissions) {
          if (submission.votes.length > (winners[0]?.votes?.length ?? 0))
            winners = [submission];
          else if (winners.length >= 1 && submission.votes.length === winners[0].votes.length)
            winners.push(submission);
        }
  
        if (winners.length === 0) {
          await response.reply({ content: `There were no voters and a winner could not be determined.` });
          finishGame(interaction.channelId);
          return;
        }
  
        /*
        proper formatting for a written list based on the number of items
        three formats:
        @user1
        @user1 and @user2
        @user1, @user2, and @user3
        */
        let allWinners;
        if (winners.length === 1)
          allWinners = `<@${winners[0].author}> (${voteCount(winners[0].votes.length)})`;
        else {
          const winnersMapped = winners.map(w => w.author);
          allWinners = `<@${winnersMapped.slice(0, winnersMapped.length-1).join(">, <@")}>${winners.length === 2 ? "" : ","} and <@${winnersMapped[winnersMapped.length-1]}>`;
        }
        
        const sendContent = winners.length === 1 ? `The winner has been determined! The winner of this game is ${allWinners}.` : `The winners have been determined! It's a tie! The winners of this game are ${allWinners} (${voteCount(winners[0].votes.length)} each).`
        
        await response.reply({
          content: sendContent,
          files: winners.map(winner => ({ attachment: winner.url })),
        });
  
        finishGame(interaction.channelId);
      });
    } catch (error) {
      console.log(error);
    }
  }
};

// format singular/plural
function voteCount(count) {
  return `${count} vote${count === 1 ? "" : "s"}`;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

module.exports.data = new SlashCommandBuilder()
  .setName("startgame")
  .setDescription("Start a generation game")
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName("topic")
      .setDescription("The topic of the game. Uses a random topic if not specified")
      .setMaxLength(100)
  );
