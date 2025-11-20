const { SlashCommandBuilder } = require("discord.js");

module.exports.execute = execute = async (prodia, interaction) => {
  await interaction.reply({ content: "Pong!" });
};

module.exports.data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Pong!")
  .setDMPermission(false);

module.exports.testGuildOnly = true;
