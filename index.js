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
  bot: "Hyggshi OS Bot",
  uptime: process.uptime()
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// ==== DISCORD CLIENT ====
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
        name: "Youtube | /help", // nội dung hiển thị
        type: 3 // 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching
      }
    ]
  });
});


// ==== READY & REGISTER SLASH COMMANDS ====
client.once("ready", async () => {
  console.log(`🤖 Bot ready: ${client.user.tag}`);

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

  try {
    console.log("📡 Đăng ký slash commands...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Slash commands đã đăng ký.");
  } catch (err) {
    console.error("❌ Lỗi khi đăng ký commands:", err);
  }
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
    await interaction.reply(`**Bot:** Hyggshi OS Bot\n**Trạng thái:** Online\n**Uptime:** ${minutes} phút ${seconds} giây`);
  }

  if (commandName === "info") {
    await interaction.reply(`🤖 **Hyggshi OS Bot** là trợ lý Discord hỗ trợ quản lý server và phản hồi tự động.\n❤️ Dev: Nguyễn Minh Phúc`);
  }

  if (commandName === "help") {
    await interaction.reply(
      "**📋 Lệnh có sẵn:**\n" +
      "🔹 `/ping`\n🔹 `/status`\n🔹 `/info`\n🔹 `/help`\n🔹 `/user`\n🔹 `/avatar`\n🔹 `/hug`\n" +
      "🔹 `/server`\n🔹 `/members`\n🔹 `/botinfo`\n🔹 `/github`\n🔹 `/say`\n🔹 `/roll`\n🔹 `/flip`\n🔹 `/uptime`"
    );
  }

  if (commandName === "server") {
    const { guild } = interaction;
    await interaction.reply(`🏠 **Máy chủ:** ${guild.name}\n👥 **Thành viên:** ${guild.memberCount}\n📆 **Tạo ngày:** <t:${Math.floor(guild.createdTimestamp/1000)}:R>`);
  }

  if (commandName === "user") {
    const user = interaction.user;
    await interaction.reply(`🧑‍💻 **Thông tin của bạn:**\n• Tên: ${user.username}#${user.discriminator}\n• ID: ${user.id}\n• Tạo tài khoản: <t:${Math.floor(user.createdTimestamp/1000)}:R>`);
  }

  if (commandName === "members") {
    await interaction.reply(`👥 Thành viên: ${interaction.guild.memberCount}`);
  }

  if (commandName === "botinfo") {
    await interaction.reply(`🤖 **Hyggshi OS Bot**\n• Phiên bản: 1.6.9 beta 23\n• Dev: Nguyễn Minh Phúc\n• Uptime: ${hours} giờ ${minutes} phút ${seconds} giây`);
  }

  if (commandName === "github") {
    await interaction.reply("🔗 **GitHub:** https://github.com/HyggshiOSDeveloper/Hyggshi-OS-project-center");
  }

  if (commandName === "say") {
    const message = interaction.options.getString("message");
    await interaction.reply(message);
  }

  if (commandName === "roll") {
    const result = Math.floor(Math.random() * 100) + 1;
    await interaction.reply(`🎲 Bạn tung được: ${result}`);
  }

  if (commandName === "flip") {
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    await interaction.reply(`💰 Coin flip: ${result}`);
  }

  if (commandName === "uptime") {
    await interaction.reply(`🕒 Uptime: ${hours} giờ ${minutes} phút ${seconds} giây`);
  }

  if (commandName === "avatar") {
    const user = interaction.options.getUser("target") || interaction.user;
    await interaction.reply({
      content: `🖼️ Avatar của **${user.tag}**:`,
      embeds: [{ image: { url: user.displayAvatarURL({ dynamic: true, size: 1024 }) }, color: 0x00aaff }]
    });
  }

  if (commandName === "hug") {
    const target = interaction.options.getUser("target") || interaction.user;
    if (target.id === interaction.user.id) {
      await interaction.reply("🤗 Bạn đã tự ôm mình rồi đó... dễ thương quá!");
    } else {
      await interaction.reply(`🤗 ${interaction.user} đã ôm ${target}!`);
    }
  }
});

// ==== CHAT AUTO-REPLY ====
client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  const content = message.content.toLowerCase();
  if (["hi", "hello","Hello bạn"].includes(content)) {
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









