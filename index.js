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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ================== SELF PING (chống Render sleep) ==================
const https = require("https");
const http = require("http");

const RENDER_URL = process.env.RENDER_URL; // vd: https://ten-bot.onrender.com

if (RENDER_URL) {
  setInterval(() => {
    const url = new URL(RENDER_URL + "/ping");
    const mod = url.protocol === "https:" ? https : http;
    mod.get(url.toString(), (res) => {
      console.log(`🔁 Self-ping: ${res.statusCode}`);
    }).on("error", (err) => {
      console.error("❌ Self-ping lỗi:", err.message);
    });
  }, 4 * 60 * 1000); // Ping mỗi 4 phút
} else {
  console.warn("⚠️ Chưa set RENDER_URL, bot có thể bị sleep!");
}

// ================== SAFETY FILTER LAYER ==================
// I. Kiến trúc hệ thống - 1️⃣ Safety Filter Layer
// Chặn: Chửi tục | Đe doạ | Bạo lực | Lệnh `say` độc hại

const BLOCKED_WORDS = [
  // Chửi tục (tiếng Việt)
  "đụ", "địt", "lồn", "cặc", "dái", "đĩ", "vãi", "cứt", "đéo", "mẹ kiếp",
  "con chó", "thằng chó", "đồ chó", "đồ điên", "mẹ mày", "bố mày", "má mày",
  // Chửi tục (tiếng Anh)
  "fuck", "shit", "bitch", "ass", "damn", "crap", "bastard", "dick", "cock",
  "pussy", "whore", "slut", "nigga", "nigger", "wtf", "stfu",
  // Đe doạ & Bạo lực
  "tao giết mày", "tao đánh mày", "tao chém", "tao bắn", "tao đốt",
  "i will kill", "i'll kill", "i will hurt", "gonna kill", "kms", "kill yourself",
  "tự tử", "treo cổ", "nhảy lầu", "uống thuốc ngủ",
  // Phân biệt chủng tộc / thù ghét
  "hate you", "die", "go die", "chết đi", "mày chết đi"
];

/**
 * Kiểm tra nội dung có vi phạm không
 * @param {string} text - Nội dung cần kiểm tra
 * @returns {{ blocked: boolean, matched: string|null }}
 */
function safetyCheck(text) {
  if (!text) return { blocked: false, matched: null };
  const lower = text.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      return { blocked: true, matched: word };
    }
  }
  return { blocked: false, matched: null };
}

/**
 * Gửi cảnh báo khi phát hiện vi phạm
 * @param {import("discord.js").Message|import("discord.js").CommandInteraction} target
 * @param {string} matched - Từ vi phạm
 * @param {"message"|"command"} type
 */
async function sendSafetyWarning(target, matched, type = "message") {
  const embed = new EmbedBuilder()
    .setTitle("🛡️ Safety Filter — Nội dung bị chặn")
    .setDescription(
      `Nội dung của bạn vi phạm quy tắc cộng đồng và đã bị hệ thống chặn.\n\n` +
      `> **Lý do:** Chứa từ ngữ không phù hợp\n` +
      `> **Từ phát hiện:** ||\`${matched}\`||\n\n` +
      `Vui lòng giữ thái độ lịch sự. Tiếp tục vi phạm có thể bị xử phạt.`
    )
    .setColor(0xff3333)
    .setFooter({ text: "Hyggshi OS Bot • Safety Filter Layer" })
    .setTimestamp();

  if (type === "message") {
    await target.reply({ embeds: [embed] }).catch(() => {});
  } else {
    await target.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
  }
}

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

  client.user.setPresence({
    status: "online",
    activities: [{ name: "Music | /help", type: 0 }]
  });

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
      .setDescription("Bot nói lại (hỗ trợ kèm ảnh)")
      .addStringOption(o =>
        o.setName("message").setDescription("Nội dung").setRequired(false)
      )
      .addAttachmentOption(o =>
        o.setName("image").setDescription("Ảnh đính kèm (tuỳ chọn)").setRequired(false)
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
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: commands });
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

  if (commandName === "say") {
    const sayMsg = interaction.options.getString("message") || "";
    const sayImage = interaction.options.getAttachment("image");

    // Phải có ít nhất message hoặc ảnh
    if (!sayMsg && !sayImage) {
      return interaction.reply({ content: "⚠️ Bạn cần nhập nội dung hoặc đính kèm ảnh!", ephemeral: true });
    }

    // Safety check nội dung text
    if (sayMsg) {
      const sayCheck = safetyCheck(sayMsg);
      if (sayCheck.blocked) {
        console.log(`🛡️ [Safety] /say bị chặn bởi ${interaction.user.tag}: "${sayMsg}"`);
        return sendSafetyWarning(interaction, sayCheck.matched, "command");
      }
    }

    // Safety check: chỉ cho phép ảnh (image/*), chặn file lạ
    if (sayImage) {
      const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
      if (!allowedTypes.includes(sayImage.contentType)) {
        return interaction.reply({
          content: "🛡️ Chỉ được đính kèm file ảnh (PNG, JPG, GIF, WEBP)!",
          ephemeral: true
        });
      }
    }

    // Xây dựng reply
    const replyPayload = {};

    if (sayMsg) replyPayload.content = sayMsg;

    if (sayImage) {
      replyPayload.embeds = [
        new EmbedBuilder()
          .setImage(sayImage.url)
          .setColor(0x5865f2)
      ];
    }

    return interaction.reply(replyPayload);
  }

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
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  // 🛡️ Safety Filter — kiểm tra mọi tin nhắn
  const check = safetyCheck(msg.content);
  if (check.blocked) {
    console.log(`🛡️ [Safety] Tin nhắn bị chặn từ ${msg.author.tag}: "${msg.content}"`);
    await sendSafetyWarning(msg, check.matched, "message");
    try { await msg.delete(); } catch (_) {} // Xoá tin nhắn vi phạm nếu có quyền
    return;
  }

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

// ================== ERROR HANDLING ==================
process.on("unhandledRejection", err => {
  console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", err => {
  console.error("❌ Uncaught Exception:", err);
});

// ================== LOGIN ==================
client.login(TOKEN).catch(err => {
  console.error("❌ Login thất bại:", err.message);
  process.exit(1);
});
