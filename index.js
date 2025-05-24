const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

// Fix node-fetch với dynamic import
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();

// EXPRESS SETUP
app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok", message: "Ping received", timestamp: Date.now() });
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

// DISCORD BOT SETUP
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", () => {
  console.log(`🤖 Bot đã sẵn sàng với tên: ${client.user.tag}`);

  // Gọi tự ping mỗi 4 phút giữ Replit luôn hoạt động
  setInterval(() => {
    fetch("https://" + process.env.REPL_SLUG + "." + process.env.REPL_OWNER + ".repl.co")
      .then(res => console.log(`🔄 Pinged self at ${new Date().toLocaleTimeString()}`))
      .catch(err => console.error("Ping error:", err));
  }, 240000); // 4 phút
});

// Slash command xử lý
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("🏓 Pong!");
  }
});

// Xử lý tin nhắn văn bản
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  if (content === "hi" || content === "hello") {
    message.reply("Chào bạn đến với server nhé! 😊");
  }
});

// Chào mừng thành viên mới
client.on("guildMemberAdd", (member) => {
  const channel = member.guild.systemChannel;
  if (channel) {
    channel.send(`👋 Chào mừng ${member.user.username} đến với server!`);
  }
});

// Đăng nhập bot
client.login(process.env.TOKEN);
