const { Client, Collection, GatewayIntentBits, Events } = require("discord.js");
const { createProdia } = require("prodia");
const { join: joinPath } = require("path");
const { readdirSync } = require("fs");
const { closeTicket } = require("./ticketManager.js");

if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN required");
if (!process.env.PRODIA_API_KEY) throw new Error("PRODIA_API_KEY required");

// create Discord client
const client = new Client({ intents: [
        GatewayIntentBits.Guilds,
] });

// create Prodia object
const prodia = createProdia({
  apiKey: process.env.PRODIA_API_KEY
});

const commands = new Collection();

client.once(Events.ClientReady, async (c) => {
  console.log(`Discord client ready as ${c.user.tag}`);

  // cache the commands so that they can be executed when an interaction is received
  const commandFiles = readdirSync((joinPath(__dirname), "commands"));

  for (const file of commandFiles) {
    const { execute, autocomplete, data } = require(`./commands/${file}`);
    commands.set(data.name, { execute, autocomplete, data });
  }

  console.log(`Cached ${commands.size} commands`);

  // check if Discord slash commands should be updated
  if (process.env.DISCORD_UPDATE_COMMANDS) {
    console.log("DISCORD_UPDATE_COMMANDS is set. Updating Discord commands...");
    await require("./registerCommands.js")(client);
    console.log("Successfully updated Discord commands");
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    // find command from the cache
    const command = commands.get(interaction.commandName);
    
    if (!command) return await interaction.reply({
      content: "That command cannot be found.",
      ephemeral: true,
    });
  
    try {
      // execute the command, if it exists
      await command.execute(prodia, interaction);
    } catch (error) {
      console.error(error);
    }
  } else if (interaction.isAutocomplete()) {
    // find command from the cache
    const command = commands.get(interaction.commandName);

    if (!command)
      return console.error(`Command ${interaction.commandName} cannot be found`);

    if (!command.autocomplete)
      return console.error(`Command ${interaction.commandName} does not have autocomplete`);
    
    try {
      // execute the command's autocomplete function, if it exists
      await command.autocomplete(prodia, interaction);
    } catch (error) {
      console.error(error);
    }
  } else if (interaction.isButton()) {
    // handle button interactions
    if (interaction.customId === "close_ticket") {
      if (!interaction.channel.name.startsWith("ticket-")) {
        return await interaction.reply({
          content: "This button can only be used in ticket channels.",
          ephemeral: true
        });
      }

      const { getTicketConfig } = require("./ticketManager.js");
      const { PermissionFlagsBits } = require("discord.js");
      const config = getTicketConfig(interaction.guildId);
      const hasPermission = interaction.member.roles.cache.has(config.supportRoleId) || 
                            interaction.memberPermissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: "Only staff members can close tickets.",
          ephemeral: true
        });
      }

      await interaction.deferReply();

      try {
        const { EmbedBuilder } = require("discord.js");
        await closeTicket(interaction.channel, interaction.user);

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("🔒 Ticket Closed")
          .setDescription(`Ticket closed by ${interaction.user.tag}`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        setTimeout(async () => {
          await interaction.channel.delete();
        }, 5000);
      } catch (error) {
        console.error("Error closing ticket:", error);
        await interaction.editReply({
          content: "There was an error closing this ticket."
        });
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    // handle select menu interactions
    if (interaction.customId === "ticket_category") {
      const { getTicketConfig, createTicket } = require("./ticketManager.js");
      const { isValidCategory, getCategoryLabel } = require("./ticketCategories.js");
      const config = getTicketConfig(interaction.guildId);

      if (!config.categoryId) {
        return await interaction.reply({
          content: "Ticket system is not set up yet. An administrator needs to run `/ticketsetup` first.",
          ephemeral: true
        });
      }

      const categoryValue = interaction.values[0];

      if (!isValidCategory(categoryValue)) {
        return await interaction.reply({
          content: "Invalid category selected. Please try again.",
          ephemeral: true
        });
      }

      const existingTicket = interaction.guild.channels.cache.find(
        ch => ch.name === `ticket-${interaction.user.id}` && ch.parentId === config.categoryId
      );

      if (existingTicket) {
        return await interaction.reply({
          content: `You already have an open ticket: <#${existingTicket.id}>`,
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const categoryLabel = getCategoryLabel(categoryValue);
        const ticketChannel = await createTicket(interaction.guild, interaction.user, config, categoryLabel);

        const { EmbedBuilder } = require("discord.js");
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("🎫 Ticket Created")
          .setDescription(`Your **${categoryLabel}** ticket has been created: <#${ticketChannel.id}>`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error("Error creating ticket:", error);
        await interaction.editReply({
          content: "There was an error creating your ticket. Please contact an administrator."
        });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);