const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { TICKET_CATEGORIES } = require("../ticketCategories.js");

module.exports.execute = async (prodia, interaction) => {
  // Admin check
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({
      content: "You need Administrator permission to create a ticket panel.",
      ephemeral: true,
    });
  }

  // Build fields for embed
  const embedFields = TICKET_CATEGORIES.map((cat) => ({
    name: `${cat.emoji} ${cat.label}`,
    value: cat.description,
    inline: false,
  }));

  const embed = new EmbedBuilder()
    .setColor(0xe8662e)
    .setTitle("🎫 Elite Shop Support")
    .setDescription(
      "Need help or want to make a purchase? Create a ticket by selecting an option from the menu below!"
    )
    .addFields(embedFields)
    .setFooter({ text: "Select a category to open a ticket" })
    .setTimestamp();

  // Build the select menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category")
    .setPlaceholder("Select a ticket category")
    .addOptions(
      TICKET_CATEGORIES.map((cat) => ({
        label: cat.label,
        description: cat.description,
        value: cat.value,
        emoji: cat.emoji,
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  // Acknowledge the command
  await interaction.reply({
    content: "Ticket panel created!",
    ephemeral: true,
  });

  // Send the actual panel message
  await interaction.channel.send({
    embeds: [embed],
    components: [row],
  });
};

module.exports.data = new SlashCommandBuilder()
  .setName("ticketpanel")
  .setDescription("Create a ticket panel with dropdown menu (Admin only)")
  .setDMPermission(false);

