const { Client } = require("discord.js");
const { join: joinPath } = require("path");
const { readdirSync } = require("fs");

// registers the updated commands w/ Discord
module.exports = async function(client) {
  if (!(client instanceof Client)) throw new Error("Parameter 'client' is required and must be an instance of Discord.Client");
  
  if (!process.env.DISCORD_APPLICATION_ID) throw new Error("DISCORD_APPLICATION_ID required");
  if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_CLIENT_ID required");

  // some commands are global, others are only shown in the test guild
  const globalCommands = [];
  const testCommands = [];

  const commandFiles = readdirSync((joinPath(__dirname), "commands"));

  for (const file of commandFiles) {
    const { data, testGuildOnly } = require(`./commands/${file}`);
    if (testGuildOnly) {
      testCommands.push(data.toJSON());
    } else {
      globalCommands.push(data.toJSON());
    }
  }

  try {
    const updated = await client.application.commands.set(globalCommands);
    console.log(`Successfully updated ${updated.size} application commands globally`);
  } catch (error) {
    console.log(error);
  }

  const testGuildId = process.env.DISCORD_TEST_GUILD_ID;

  // don't bother updating the test commands if there's no test guild specified
  if (testGuildId) {
    try {
      const updated = await client.application.commands.set(testCommands, testGuildId);
      console.log(`Successfully updated ${updated.size} application commands to test guild ${testGuildId}`);
    } catch (error) {
      console.log(error);
    }
  } else
    console.log(`No DISCORD_TEST_GUILD_ID specified. Ignoring ${testCommands.length} test commands`);
}