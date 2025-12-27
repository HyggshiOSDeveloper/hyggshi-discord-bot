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

const app = express();

// ==== EXPRESS – Health check ====
app.get("/", (req, res) => res.send("🤖 Hyggshi OS Bot is alive!"));
app.get("/ping", (req, res) => res.json({ 
  status: "ok", 
  timestamp: Date.now(),
  uptime: process.uptime()
}));
app.get("/status", (req, res) => res.json({
  status: "online",
  bot: client.user?.tag || "Starting...",
  uptime: process.uptime(),
  guilds: client.guilds?.cache.size || 0
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

// ==== BOT READY ====
client.once("ready", async () => {
  console.log(`✅ Bot ready: ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);

  // Set presence
  client.user.setPresence({
    status: "online",
    activities: [{
      name: "Music | /help",
      type: ActivityType.Listening
    }]
  });

  // Register slash commands
  await registerCommands();
});

// ==== REGISTER SLASH COMMANDS ====
async function registerCommands() {
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
      .addStringOption(option => 
        option.setName("message")
          .setDescription("Câu bạn muốn bot lặp lại")
          .setRequired(true)
      ),
    new SlashCommandBuilder().setName("roll").setDescription("Tung xúc xắc 1-100"),
    new SlashCommandBuilder().setName("flip").setDescription("Tung đồng xu (Heads/Tails)"),
    new SlashCommandBuilder()
      .setName("avatar")
      .setDescription("Xem avatar của bạn hoặc người khác")
      .addUserOption(option => 
        option.setName("target")
          .setDescription("Người bạn muốn xem avatar")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("hug")
      .setDescription("Ôm một người nào đó")
      .addUserOption(option => 
        option.setName("target")
          .setDescription("Người muốn ôm")
          .setRequired(false)
      ),
    new SlashCommandBuilder().setName("uptime").setDescription("Xem thời gian bot chạy")
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("📡 Đăng ký slash commands...");
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ Slash commands đã đăng ký thành công!");
  } catch (err) {
    console.error("❌ Lỗi khi đăng ký commands:", err);
  }
}

// ==== SLASH COMMAND HANDLER ====
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  const { commandName } = interaction;
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  try {
    switch (commandName) {
      case "ping":
        const ping = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`🏓 Pong! Latency: ${ping}ms | API: ${Math.round(client.ws.ping)}ms`);
        break;

      case "status":
        await interaction.reply(
          `**Bot:** Hyggshi OS Bot\n` +
          `**Trạng thái:** Online ✅\n` +
          `**Uptime:** ${hours}h ${minutes}m ${seconds}s\n` +
          `**Servers:** ${client.guilds.cache.size}\n` +
          `**Platform:** Railway`
        );
        break;

      case "info":
        await interaction.reply(
          `🤖 **Hyggshi OS Bot** là trợ lý Discord hỗ trợ quản lý server.\n` +
          `❤️ Dev: Nguyễn Minh Phúc\n` +
          `🚂 Hosted on Railway`
        );
        break;

      case "help":
        await interaction.reply({
          embeds: [{
            title: "📋 Danh sách lệnh",
            description: 
              "🔹 `/ping` - Kiểm tra độ trễ\n" +
              "🔹 `/status` - Trạng thái bot\n" +
              "🔹 `/info` - Giới thiệu\n" +
              "🔹 `/help` - Danh sách lệnh\n" +
              "🔹 `/user` - Thông tin tài khoản\n" +
              "🔹 `/avatar` - Xem avatar\n" +
              "🔹 `/hug @user` - Ôm ai đó\n" +
              "🔹 `/server` - Thông tin server\n" +
              "🔹 `/members` - Số thành viên\n" +
              "🔹 `/botinfo` - Thông tin bot\n" +
              "🔹 `/github` - Link GitHub\n" +
              "🔹 `/say <text>` - Bot lặp lại\n" +
              "🔹 `/roll` - Tung xúc xắc\n" +
              "🔹 `/flip` - Tung đồng xu\n" +
              "🔹 `/uptime` - Thời gian chạy",
            color: 0x00aaff,
            footer: { text: "Hyggshi OS Bot v2.1" }
          }]
        });
        break;

      case "server":
        const { guild } = interaction;
        await interaction.reply({
          embeds: [{
            title: "🏠 Thông tin Server",
            fields: [
              { name: "Tên", value: guild.name, inline: true },
              { name: "Thành viên", value: `${guild.memberCount}`, inline: true },
              { name: "Ngày tạo", value: `<t:${Math.floor(guild.createdTimestamp/1000)}:R>`, inline: false }
            ],
            thumbnail: { url: guild.iconURL() },
            color: 0x00ff00
          }]
        });
        break;

      case "user":
        const user = interaction.user;
        await interaction.reply({
          embeds: [{
            title: "🧑‍💻 Thông tin của bạn",
            fields: [
              { name: "Username", value: user.tag, inline: true },
              { name: "ID", value: user.id, inline: true },
              { name: "Ngày tạo", value: `<t:${Math.floor(user.createdTimestamp/1000)}:R>`, inline: false }
            ],
            thumbnail: { url: user.displayAvatarURL({ dynamic: true }) },
            color: 0x5865f2
          }]
        });
        break;

      case "members":
        await interaction.reply(`👥 Server có **${interaction.guild.memberCount}** thành viên`);
        break;

      case "botinfo":
        await interaction.reply({
          embeds: [{
            title: "🤖 Hyggshi OS Bot",
            fields: [
              { name: "Phiên bản", value: "2.1.0 (Railway)", inline: true },
              { name: "Dev", value: "Nguyễn Minh Phúc", inline: true },
              { name: "Uptime", value: `${hours}h ${minutes}m ${seconds}s`, inline: false },
              { name: "Servers", value: `${client.guilds.cache.size}`, inline: true },
              { name: "Platform", value: "🚂 Railway", inline: true }
            ],
            color: 0xf38020
          }]
        });
        break;

      case "github":
        await interaction.reply("🔗 **GitHub:** https://github.com/HyggshiOSDeveloper/hyggshi-discord-bot");
        break;

      case "say":
        const message = interaction.options.getString("message");
        await interaction.reply(message);
        break;

      case "roll":
        const result = Math.floor(Math.random() * 100) + 1;
        await interaction.reply(`🎲 Bạn tung được: **${result}**`);
        break;

      case "flip":
        const coin = Math.random() < 0.5 ? "Heads 🪙" : "Tails 🪙";
        await interaction.reply(`💰 Coin flip: **${coin}**`);
        break;

      case "uptime":
        await interaction.reply(`🕒 Bot đã chạy được: **${hours}** giờ **${minutes}** phút **${seconds}** giây`);
        break;

      case "avatar":
        const target = interaction.options.getUser("target") || interaction.user;
        await interaction.reply({
          embeds: [{
            title: `🖼️ Avatar của ${target.tag}`,
            image: { url: target.displayAvatarURL({ dynamic: true, size: 1024 }) },
            color: 0x00aaff
          }]
        });
        break;

      case "hug":
        const hugTarget = interaction.options.getUser("target");
        if (!hugTarget || hugTarget.id === interaction.user.id) {
          await interaction.reply("🤗 Bạn đã tự ôm mình rồi đó... dễ thương quá!");
        } else {
          await interaction.reply(`🤗 ${interaction.user} đã ôm ${hugTarget}! 💕`);
        }
        break;

      default:
        await interaction.reply("❌ Lệnh không tồn tại!");
    }
  } catch (error) {
    console.error("Command error:", error);
    if (!interaction.replied) {
      await interaction.reply("❌ Đã xảy ra lỗi khi xử lý lệnh!");
    }
  }
});

// ==== AUTO-REPLY ====
client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  
  const content = message.content.toLowerCase();
  if (["hi", "hello", "chào"].includes(content)) {
    message.reply("Xin chào! Dùng `/help` để xem danh sách lệnh nhé! 😊");
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

// ==== ERROR HANDLING ====
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

// ==== LOGIN ====
if (!process.env.TOKEN) {
  console.error("❌ DISCORD TOKEN không được cấu hình trong file .env!");
  process.exit(1);
}

client.login(process.env.TOKEN).catch(err => {
  console.error("❌ Không thể login bot:", err);
  process.exit(1);
});
