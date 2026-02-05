require("dotenv").config();
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActivityType
} = require("discord.js");

/* ================= EXPRESS (KEEP ALIVE) ================= */
const app = express();

app.get("/", (req, res) => {
  res.send("🤖 Hyggshi OS Bot is alive!");
});

app.get("/ping", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    time: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🌐 Web server running on port ${PORT}`)
);

/* ================= DISCORD CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= READY ================= */
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📊 Servers: ${client.guilds.cache.size}`);

  // Presence = ONLINE
  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "Hyggshi OS | /help",
        type: ActivityType.Playing
      }
    ]
  });

  await registerCommands();
});

/* ================= SLASH COMMANDS ================= */
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Ping bot"),
    new SlashCommandBuilder().setName("status").setDescription("Bot status"),
    new SlashCommandBuilder().setName("help").setDescription("Danh sách lệnh"),
    new SlashCommandBuilder().setName("uptime").setDescription("Thời gian chạy")
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("📡 Registering slash commands...");
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Slash command error:", err);
  }
}

/* ================= INTERACTION HANDLER ================= */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);

  try {
    switch (interaction.commandName) {
      case "ping":
        await interaction.reply(
          `🏓 Pong! API: ${Math.round(client.ws.ping)}ms`
        );
        break;

      case "status":
        await interaction.reply(
          `🟢 **ONLINE**\n` +
          `⏱️ Uptime: ${h}h ${m}m ${s}s\n` +
          `🌐 Servers: ${client.guilds.cache.size}`
        );
        break;

      case "uptime":
        await interaction.reply(
          `⏱️ Bot chạy được: ${h}h ${m}m ${s}s`
        );
        break;

      case "help":
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("📜 Hyggshi OS Bot Commands")
              .setDescription(
                "/ping – Ping bot\n" +
                "/status – Trạng thái\n" +
                "/uptime – Thời gian chạy\n" +
                "/help – Danh sách lệnh"
              )
              .setColor(0x00aaff)
          ]
        });
        break;
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      interaction.reply("❌ Có lỗi xảy ra");
    }
  }
});

/* ================= AUTO REPLY ================= */
client.on("messageCreate", msg => {
  if (msg.author.bot) return;
  if (["hi", "hello", "chào"].includes(msg.content.toLowerCase())) {
    msg.reply("Xin chào 👋 dùng `/help` nhé!");
  }
});

/* ================= LOGS ================= */
client.on("disconnect", () => console.log("❌ Disconnected"));
client.on("reconnecting", () => console.log("🔄 Reconnecting"));
process.on("unhandledRejection", console.error);

/* ================= LOGIN ================= */
if (!process.env.TOKEN) {
  console.error("❌ Missing DISCORD TOKEN");
  process.exit(1);
}

client.login(process.env.TOKEN);
