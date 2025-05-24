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

// =====================================================================================
//                                command creation section                                
// =====================================================================================
  
  const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Kiểm tra độ trễ phản hồi của bot"),
    new SlashCommandBuilder().setName("status").setDescription("Hiển thị trạng thái hoạt động của bot"),
    new SlashCommandBuilder().setName("info").setDescription("Giới thiệu về Hyggshi OS Bot"),
    new SlashCommandBuilder().setName("help").setDescription("Danh sách các lệnh có sẵn"),
    new SlashCommandBuilder().setName("server").setDescription("Hiển thị thông tin máy chủ"),
    new SlashCommandBuilder().setName("user").setDescription("Xem thông tin tài khoản Discord của bạn"),
    new SlashCommandBuilder().setName("members").setDescription("Xem số thành viên trong server"),
    new SlashCommandBuilder().setName("botinfo").setDescription("Thông tin bot: phiên bản, dev, uptime"),
    new SlashCommandBuilder().setName("github").setDescription("Link GitHub của dự án"),
    new SlashCommandBuilder().setName("say").setDescription("Câu bạn muốn bot lặp lại"),
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
      .setDescription("Ôm một người nào đó trong server")
      .addUserOption(option =>
        option.setName("target")
          .setDescription("Người bạn muốn ôm")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
  .setName("say")
  .setDescription("Bot lặp lại câu bạn nhập")
  .addStringOption(option =>
    option.setName("message")
      .setDescription("Câu bạn muốn bot lặp lại")
      .setRequired(true)
  ),

    new SlashCommandBuilder().setName("uptime").setDescription("Xem thời gian bot đã hoạt động")
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
      `Được phát triển với ❤️ bởi Hyggshi OS developer / Nguyễn Minh Phúc`
    );
  }

  if (commandName === "help") {
    await interaction.reply(
      `📋 **Các lệnh có sẵn:**\n` +
      `• /ping – Kiểm tra độ trễ\n` +
      `• /status – Trạng thái bot\n` +
      `• /info – Giới thiệu bot\n` +
      `• /help – Danh sách lệnh\n` +
      `• /user – Thông tin người dùng\n` +
      `• /avatar – Avatar người dùng\n` +
      `• /hug – Ôm ai đó\n` +
      `• /server – Thông tin máy chủ\n` +
      `• /members – Thông tin máy chủ\n` +
      `• /botinfo – Thông tin máy chủ\n` +
      `• /github – Thông tin máy chủ\n` +
      `• /uptime – Thời gian bot chạy`
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

  if (commandName === "user") {
    const user = interaction.user;
    await interaction.reply(
      `🧑‍💻 **Thông tin của bạn:**\n` +
      `• Tên: ${user.username}#${user.discriminator}\n` +
      `• ID: ${user.id}\n` +
      `• Tạo tài khoản: <t:${Math.floor(user.createdTimestamp / 1000)}:R>`
    );
  }

  if (commandName === "avatar") {
    const user = interaction.options.getUser("target") || interaction.user;
    await interaction.reply({
      content: `🖼️ Avatar của **${user.tag}**:`,
      embeds: [
        {
          image: { url: user.displayAvatarURL({ dynamic: true, size: 1024 }) },
          color: 0x00aaff
        }
      ]
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

if (commandName === "members") {
  const memberCount = interaction.guild.memberCount;
  await interaction.reply(`👥 Thành viên: ${memberCount}`);
}

if (commandName === "botinfo") {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  await interaction.reply(
    `🤖 **Hyggshi OS Bot**\n` +
    `• Phiên bản: 1.0.0\n` +
    `• Dev: Nguyễn Minh Phúc\n` +
    `• Uptime: ${hours} giờ ${minutes} phút ${seconds} giây`
  );
}

if (commandName === "github") {
  await interaction.reply("🔗 **GitHub:** https://github.com/HyggshiOSDeveloper/Hyggshi-OS-project-center");
}
  
  if (commandName === "say") {
  const message = interaction.options.getString("message");
  await interaction.reply(message);
}

  
  if (commandName === "uptime") {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    await interaction.reply(
      `🕒 **Uptime:** ${hours} giờ ${minutes} phút ${seconds} giây`
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
