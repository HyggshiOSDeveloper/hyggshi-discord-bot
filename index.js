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
    new SlashCommandBuilder().setName("ping").setDescription("Kiểm tra độ trễ phản hồi của bot"),
    new SlashCommandBuilder().setName("status").setDescription("Hiển thị trạng thái hoạt động của bot"),
    new SlashCommandBuilder().setName("info").setDescription("Giới thiệu về Hyggshi OS Bot"),
    new SlashCommandBuilder().setName("help").setDescription("Danh sách các lệnh có sẵn"),
    new SlashCommandBuilder().setName("server").setDescription("Hiển thị thông tin máy chủ"),
    new SlashCommandBuilder().setName("user").setDescription("Xem thông tin tài khoản Discord của bạn"),
    new SlashCommandBuilder()
      .setName("avatar")
      .setDescription("Xem avatar của bạn hoặc người khác")
      .addUserOption(option =>
        option.setName("target")
          .setDescription("Chọn người dùng")
          .setRequired(false)
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
      `• /server – Thông tin máy chủ\n` +
      `• /uptime – Thời gian bot đã chạy`
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

