require("dotenv").config();
const express = require("express");
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");

const app = express();

// EXPRESS – giữ bot sống
app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/status", (req, res) => {
  res.json({
    status: "online",
    bot: "Hyggshi OS Bot",
    uptime: process.uptime(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Web server is running on port ${PORT}`);
});

// DISCORD CLIENT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", async () => {
  console.log(`🤖 Bot đã sẵn sàng: ${client.user.tag}`);

  // Đăng ký slash command /ping
  const commands = [
    new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Kiểm tra bot có đang hoạt động"),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("📡 Đăng ký slash command...");
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ Slash command đã được đăng ký.");
  } catch (err) {
    console.error("❌ Lỗi khi đăng ký slash command:", err);
  }
});

// Slash command handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("🏓 Pong!");
  }
});

// Chat auto-reply
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  if (content === "hi" || content === "hello") {
    message.reply("Chào bạn đến với server nhé! 😊");
  }
});

// Welcome new member
client.on("guildMemberAdd", (member) => {
  const channel = member.guild.systemChannel;
  if (channel) {
    channel.send(`👋 Chào mừng ${member.user.username} đến với server!`);
  }
});

// Start bot
client.login(process.env.TOKEN);
