require("dotenv").config();
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

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

  const commands = [
    new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Kiểm tra độ trễ phản hồi của bot"),
    new SlashCommandBuilder()
      .setName("status")
      .setDescription("Hiển thị trạng thái hoạt động của bot"),
    new SlashCommandBuilder()
      .setName("info")
      .setDescription("Giới thiệu về Hyggshi OS Bot"),
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("Danh sách các lệnh có sẵn"),
    new SlashCommandBuilder()
      .setName("server")
      .setDescription("Hiển thị thông tin máy chủ")
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

  const { commandName } = interaction;

  if (commandName === "ping") {
    const ping = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`🏓 Ping: ${ping} ms`);
  }

  if (commandName === "status") {
    const uptimeSeconds = process.uptime();
    const minutes = Math.floor(uptimeSeconds / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    await interaction.reply(
      `**Bot:** Hyggshi OS Bot\n` +
      `**Trạng thái:** Online\n` +
      `**Uptime:** ${minutes} phút ${seconds} giây`
    );
  }

  if (commandName === "info") {
    await interaction.reply(
      `🤖 **Hyggshi OS Bot** là trợ lý Discord giúp quản lý máy chủ, gửi phản hồi tự động và hỗ trợ slash commands.\n` +
      `Được phát triển với ❤️ by Hyggshi OS developer / Nguyễn Minh Phúc`
    );
  }

  if (commandName === "help") {
    await interaction.reply(
      `📋 **Các lệnh có sẵn:**\n` +
      `• /ping – Kiểm tra độ trễ\n` +
      `• /status – Xem trạng thái bot\n` +
      `• /info – Giới thiệu bot\n` +
      `• /help – Danh sách lệnh\n` +
      `• /server – Thông tin máy chủ`
    );
  }

  if (commandName === "server") {
    const { guild } = interaction;
    await interaction.reply(
      `🏠 **Máy chủ:** ${guild.name}\n` +
      `👥 **Thành viên:** ${guild.memberCount}\n` +
      `📆 **Tạo ngày:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`
    );
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
