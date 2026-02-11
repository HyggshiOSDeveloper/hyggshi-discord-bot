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

// ================== ENV ==================
const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;
const PORT = process.env.PORT || 10000;

// ================== EXPRESS ==================
const app = express();

app.get("/", (req, res) => res.send("Bot is alive!"));
app.get("/ping", (req, res) => res.json({ status: "ok", time: Date.now() }));
app.get("/status", (req, res) => res.json({
  status: "online",
  bot: "Hyggshi OS Bot",
  uptime: process.uptime()
}));

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ================== DISCORD CLIENT ==================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ================== READY ==================
client.once("ready", async () => {
  console.log(`🤖 Bot ready: ${client.user.tag}`);

  // Presence
  client.user.setPresence({
    status: "online",
    activities: [{ name: "Music | /help", type: 0 }]
  });

  // Slash Commands
  const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Kiểm tra độ trễ phản hồi"),
    new SlashCommandBuilder().setName("status").setDescription("Trạng thái bot"),
    new SlashCommandBuilder().setName("info").setDescription("Giới thiệu bot"),
    new SlashCommandBuilder().setName("help").setDescription("Danh sách lệnh"),
    new SlashCommandBuilder().setName("server").setDescription("Thông tin server"),
    new SlashCommandBuilder().setName("user").setDescription("Thông tin tài khoản"),
    new SlashCommandBuilder().setName("members").setDescription("Số thành viên"),
    new SlashCommandBuilder().setName("botinfo").setDescription("Thông tin bot"),
    new SlashCommandBuilder().setName("github").setDescription("GitHub dự án"),
    new SlashCommandBuilder()
      .setName("say")
      .setDescription("Bot nói lại")
      .addStringOption(o =>
        o.setName("message").setDescription("Nội dung").setRequired(true)
      ),
    new SlashCommandBuilder().setName("roll").setDescription("Tung xúc xắc 1-100"),
    new SlashCommandBuilder().setName("flip").setDescription("Tung đồng xu"),
    new SlashCommandBuilder().setName("uptime").setDescription("Thời gian chạy bot"),
    new SlashCommandBuilder()
      .setName("avatar")
      .setDescription("Xem avatar")
      .addUserOption(o =>
        o.setName("target").setDescription("Người muốn xem")
      ),
    new SlashCommandBuilder()
      .setName("hug")
      .setDescription("Ôm ai đó")
      .addUserOption(o =>
        o.setName("target").setDescription("Người muốn ôm")
      )
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("📡 Registering slash commands...");
    await rest.put(
      Routes.applicationCommands(APPLICATION_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered!");
  } catch (err) {
    console.error("❌ Slash command error:", err);
  }
});

// ================== SLASH HANDLER ==================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);

  if (commandName === "ping")
    return interaction.reply(`🏓 Ping: ${Date.now() - interaction.createdTimestamp} ms`);

  if (commandName === "status")
    return interaction.reply(`🟢 Online\n⏱️ ${m} phút ${s} giây`);

  if (commandName === "info")
    return interaction.reply("🤖 **Hyggshi OS Bot**\nDev: Nguyễn Minh Phúc");

  if (commandName === "help")
    return interaction.reply("📋 `/ping /status /info /help /server /user /avatar /hug /roll /flip /uptime`");

  if (commandName === "server") {
    const g = interaction.guild;
    return interaction.reply(`🏠 ${g.name}\n👥 ${g.memberCount}`);
  }

  if (commandName === "user") {
    const u = interaction.user;
    return interaction.reply(`👤 ${u.tag}\n🆔 ${u.id}`);
  }

  if (commandName === "members")
    return interaction.reply(`👥 ${interaction.guild.memberCount}`);

  if (commandName === "botinfo")
    return interaction.reply(`🤖 Hyggshi OS Bot\n⏱️ ${h}h ${m}m ${s}s`);

  if (commandName === "github")
    return interaction.reply("🔗 https://github.com/HyggshiOSDeveloper/Hyggshi-OS-project-center");

  if (commandName === "say")
    return interaction.reply(interaction.options.getString("message"));

  if (commandName === "roll")
    return interaction.reply(`🎲 ${Math.floor(Math.random() * 100) + 1}`);

  if (commandName === "flip")
    return interaction.reply(`💰 ${Math.random() < 0.5 ? "Heads" : "Tails"}`);

  if (commandName === "uptime")
    return interaction.reply(`🕒 ${h}h ${m}m ${s}s`);

  if (commandName === "avatar") {
    const u = interaction.options.getUser("target") || interaction.user;
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(u.tag)
          .setImage(u.displayAvatarURL({ size: 1024 }))
          .setColor(0x00aaff)
      ]
    });
  }

  if (commandName === "hug") {
    const t = interaction.options.getUser("target") || interaction.user;
    return interaction.reply(`🤗 ${interaction.user} ôm ${t}`);
  }
});

// ================== AUTO CHAT ==================
client.on("messageCreate", msg => {
  if (msg.author.bot) return;
  if (["hi", "hello", "xin chào"].includes(msg.content.toLowerCase())) {
    msg.reply("👋 Chào bạn!");
  }
});

// ================== WELCOME ==================
const welcomes = [
  "Chào mừng bạn! 🎉",
  "Rất vui khi thấy bạn! 😄",
  "Enjoy nhé! ✨"
];

client.on("guildMemberAdd", member => {
  const ch = member.guild.channels.cache.find(c => c.name === "welcome");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("🎉 Welcome")
    .setDescription(`${welcomes[Math.floor(Math.random() * welcomes.length)]} ${member}`)
    .setThumbnail(member.user.displayAvatarURL())
    .setColor(0x00ff00);

  ch.send({ embeds: [embed] });
});

// ================== LOGIN ==================
client.login(TOKEN);
