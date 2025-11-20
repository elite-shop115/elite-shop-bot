const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require("discord.js");
const { setupTicketSystem } = require("../ticketManager.js");

module.exports.execute = async (prodia, interaction) => {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({
      content: "You need Administrator permission to set up the ticket system.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const { category, supportRole } = await setupTicketSystem(interaction.guild);

    const embed = new EmbedBuilder()
      .setColor(0xe8662e)
      .setTitle("✅ Ticket System Setup Complete")
      .setDescription("The ticket system has been configured!")
      .addFields(
        { name: "Category", value: `<#${category.id}>`, inline: true },
       { name: "Support Role", value: `<@&${supportRole.id}>`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error setting up ticket system:", error);
    await interaction.editReply({
      content: "There was an error setting up the ticket system. Please check my permissions."
    });
  }
};

module.exports.data = new SlashCommandBuilder()
  .setName("ticketsetup")
  .setDescription("Set up the ticket system (Admin only)")
  .setDMPermission(false);
