require("dotenv").config();
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const app = express();

// ==== EXPRESS – giữ bot sống ====
app.get("/", (req, res) => res.send("Bot is alive!"));
app.get("/ping", (req, res) => res.json({ status: "ok", timestamp: Date.now() }));
app.get("/status", (req, res) => res.json({
  status: "online",
  bot: "Minh P Bot",
  uptime: process.uptime()
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// ==== DISCORD CLIENT ====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
// ==== DISCORD CLIENT ====
const token = process.env.TOKEN || process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ Thiếu TOKEN/DISCORD_TOKEN trong biến môi trường. Bot không thể đăng nhập.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

client.once("ready", () => {
  console.log(`🤖 Bot ready: ${client.user.tag}`);

  // Set activity / trạng thái
  client.user.setPresence({
    status: "online", // online, idle, dnd, invisible
    activities: [
      {
        name: "Hyggshi OS Bot | /help", // nội dung hiển thị
        type: 0 // 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching
      }
    ]
  });
});


// ==== READY & REGISTER SLASH COMMANDS ====
client.once("ready", async () => {
  console.log(`🤖 Bot ready: ${client.user.tag}`);

  const commands = [
});

// ==== READY & REGISTER SLASH COMMANDS ====
client.once("ready", async () => {
  console.log(`🤖 Bot ready: ${client.user.tag}`);

  // Set activity / trạng thái
  client.user.setPresence({
    status: "online", // online, idle, dnd, invisible
    activities: [
      {
        name: "Hyggshi OS Bot | /help", // nội dung hiển thị
        type: 0 // 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching
      }
    ]
  });

  const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Kiểm tra độ trễ phản hồi của bot"),
    new SlashCommandBuilder().setName("status").setDescription("Hiển thị trạng thái bot"),
    new SlashCommandBuilder().setName("info").setDescription("Giới thiệu bot"),
    new SlashCommandBuilder().setName("help").setDescription("Danh sách lệnh có sẵn"),
    new SlashCommandBuilder().setName("server").setDescription("Thông tin máy chủ"),
    new SlashCommandBuilder().setName("user").setDescription("Xem thông tin tài khoản Discord"),
    new SlashCommandBuilder().setName("members").setDescription("Số thành viên trong server"),
    new SlashCommandBuilder().setName("botinfo").setDescription("Thông tin bot"),
    new SlashCommandBuilder().setName("github").setDescription("Link GitHub dự án"),
    new SlashCommandBuilder()
      .setName("say")
      .setDescription("Bot lặp lại câu bạn nhập")
      .addStringOption(option => option.setName("message").setDescription("Câu bạn muốn bot lặp lại").setRequired(true)),
    new SlashCommandBuilder().setName("roll").setDescription("Tung xúc xắc 1-100"),
    new SlashCommandBuilder().setName("flip").setDescription("Tung đồng xu (Heads/Tails)"),
    new SlashCommandBuilder()
      .setName("avatar")
      .setDescription("Xem avatar của bạn hoặc người khác")
      .addUserOption(option => option.setName("target").setDescription("Người bạn muốn xem avatar").setRequired(false)),
    new SlashCommandBuilder()
      .setName("hug")
      .setDescription("Ôm một người nào đó")
      .addUserOption(option => option.setName("target").setDescription("Người muốn ôm").setRequired(false)),
    new SlashCommandBuilder().setName("uptime").setDescription("Xem thời gian bot chạy")
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("📡 Đăng ký slash commands...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Slash commands đã đăng ký.");
  } catch (err) {
    console.error("❌ Lỗi khi đăng ký commands:", err);
  }
});
    console.error("❌ Lỗi khi đăng ký commands:", err);
  }
});

client.on("error", (error) => {
  console.error("❌ Discord client error:", error);
});

client.on("shardError", (error) => {
  console.error("❌ Discord shard error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

// ==== SLASH COMMAND HANDLER ====
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  if (commandName === "ping") {
    const ping = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`🏓 Ping: ${ping} ms`);
  }

  if (commandName === "status") {
    await interaction.reply(`**Bot:** Minh P Bot\n**Trạng thái:** Online\n**Uptime:** ${minutes} phút ${seconds} giây`);
  }

  if (commandName === "info") {
    await interaction.reply(`🤖 **Minh P Bot** là trợ lý Discord hỗ trợ quản lý server và phản hồi tự động.\n❤️ Dev: Nguyễn Minh Phúc`);
  }

  if (commandName === "help") {
@@ -189,27 +203,30 @@ client.on("messageCreate", (message) => {
    message.reply("Chào bạn đến với server nhé! 😊");
  }
});

// ==== WELCOME NEW MEMBER ====
const welcomes = [
  "Chào bạn đến server! 🥳",
  "Rất vui khi thấy bạn! 😄",
  "Hãy tận hưởng thời gian ở đây nhé! 🎈",
  "Xin chào! Chúc bạn có trải nghiệm tuyệt vời! ✨"
];

client.on("guildMemberAdd", (member) => {
  const channel = member.guild.channels.cache.find(ch => ch.name === "welcome");
  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle("🎉 Chào mừng!")
      .setDescription(`${welcomes[Math.floor(Math.random() * welcomes.length)]} ${member.user}`)
      .setColor(0x00ff00)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    channel.send({ embeds: [embed] });
  }
});

// ==== START BOT ====
client.login(process.env.TOKEN);
// ==== START BOT ====
client.login(token).catch((error) => {
  console.error("❌ Đăng nhập thất bại. Kiểm tra token và quyền intents.", error);
  process.exit(1);
});
