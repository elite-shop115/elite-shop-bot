const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fs = require("fs");
const path = require("path");

const TICKET_DATA_FILE = path.join(__dirname, "ticketData.json");

// LOAD & SAVE SYSTEM
function loadTicketData() {
  if (!fs.existsSync(TICKET_DATA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(TICKET_DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Error loading ticket data:", error);
    return {};
  }
}

function saveTicketData(data) {
  try {
    fs.writeFileSync(TICKET_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving ticket data:", error);
  }
}

// CONFIG SYSTEM
function getTicketConfig(guildId) {
  const data = loadTicketData();
  return data[guildId] || { categoryId: null, ticketCount: 1 };
}

async function setupTicketSystem(guild) {
  const data = loadTicketData();

  // Create or locate "Tickets" category
  let category = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildCategory && ch.name === "Tickets"
  );

  if (!category) {
    category = await guild.channels.create({
      name: "Tickets",
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        }
      ]
    });
  }

  // Save system config
  data[guild.id] = {
    categoryId: category.id,
    ticketCount: data[guild.id]?.ticketCount ?? 1
  };

  saveTicketData(data);
  return { category };
}

// CREATE TICKET CHANNEL
async function createTicket(guild, user, config, category = null) {
  const data = loadTicketData();

  if (!data[guild.id].ticketCount) {
    data[guild.id].ticketCount = 1;
  }

  const ticketNumber = data[guild.id].ticketCount.toString().padStart(3, "0");

  // 🔥 ADD YOUR SUPPORT ROLE HERE
  const SUPPORT_ROLE_ID = "1439954987126886420"; 

  // Create secure private ticket channel
  const ticketChannel = await guild.channels.create({
    name: `ticket-${ticketNumber}`,
    type: ChannelType.GuildText,
    parent: config.categoryId,
    permissionOverwrites: [
      // Hide for @everyone
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },

      // Allow the ticket creator
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },

      // Allow support team
      {
        id: SUPPORT_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ]
  });

  // Increment ticket counter
  data[guild.id].ticketCount++;
  saveTicketData(data);

  // Build ticket embed
  const fields = [
    { name: "Created by", value: user.tag, inline: true },
    { name: "Created at", value: new Date().toLocaleString(), inline: true },
    { name: "Ticket Number", value: ticketNumber, inline: true }
  ];

  if (category) {
    fields.push({ name: "Category", value: category, inline: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0xe8662e)
    .setTitle(`🎫 Support Ticket #${ticketNumber}`)
    .setDescription(`Welcome ${user}! Please describe your issue in detail.`)
    .addFields(fields)
    .setFooter({ text: "A support team member will be with you shortly." })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒")
  );

  await ticketChannel.send({
    content: `${user}`,
    embeds: [embed],
    components: [row]
  });

  return ticketChannel;
}

// CLOSE TICKET
async function closeTicket(channel, user) {
  const transcript = [];

  const messages = await channel.messages.fetch({ limit: 100 });
  messages.reverse().forEach(msg => {
    transcript.push(`[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}`);
  });

  console.log(`Ticket ${channel.name} closed by ${user.tag}`);
  console.log("Transcript:", transcript.join("\n"));
}

module.exports = {
  getTicketConfig,
  setupTicketSystem,
  createTicket,
  closeTicket
};
