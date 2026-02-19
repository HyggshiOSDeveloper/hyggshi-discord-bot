require("dotenv").config();
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
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
    // Interaction đã được defer → dùng editReply
    await target.editReply({ embeds: [embed] }).catch(() => {});
  }
}

// ================== CALM MODE ==================
// I. Kiến trúc hệ thống - 2️⃣ Calm Mode
// Nếu chat quá nóng → Bot chuyển sang chế độ nghiêm túc 5 phút

const CALM_MODE_DURATION = 5 * 60 * 1000; // 5 phút
const CALM_TRIGGER_COUNT = 3;              // Vi phạm để kích hoạt
const CALM_WINDOW_MS     = 60 * 1000;     // Cửa sổ đếm vi phạm: 1 phút
const CALM_WARN_COOLDOWN = 15 * 1000;     // Cooldown nhắc nhở "calm mode" mỗi user: 15 giây

/**
 * State per guild:
 *   violations   — timestamps vi phạm gần đây
 *   activatedAt  — thời điểm bật (null = tắt)
 *   timer        — auto-off timer
 *   warnCooldown — Map<userId, lastWarnTimestamp> để tránh spam nhắc nhở
 *   slowMode     — Map<userId, lastMessageTimestamp> để giới hạn tốc độ nhắn
 */
const calmState = new Map();

function getCalmState(guildId) {
  if (!calmState.has(guildId)) {
    calmState.set(guildId, {
      violations:   [],
      activatedAt:  null,
      timer:        null,
      warnCooldown: new Map(),
      slowMode:     new Map()
    });
  }
  return calmState.get(guildId);
}

/** Calm Mode có đang bật không? */
function isCalmMode(guildId) {
  return getCalmState(guildId).activatedAt !== null;
}

/** Số giây còn lại của Calm Mode */
function calmModeRemaining(guildId) {
  const state = getCalmState(guildId);
  if (!state.activatedAt) return 0;
  return Math.max(0, Math.ceil((CALM_MODE_DURATION - (Date.now() - state.activatedAt)) / 1000));
}

/** Bật Calm Mode — gửi thông báo + đặt timer tắt */
async function activateCalmMode(guildId, channel) {
  const state = getCalmState(guildId);
  if (state.activatedAt) return; // Đã bật rồi

  state.activatedAt = Date.now();
  state.violations  = [];
  state.warnCooldown.clear();
  state.slowMode.clear();
  console.log(`[Calm Mode] 🔴 Kích hoạt tại guild ${guildId}`);

  // Gửi thông báo BẬT
  const onEmbed = new EmbedBuilder()
    .setTitle("🧘 Calm Mode — Đã kích hoạt")
    .setDescription(
      `⚠️ Phát hiện **${CALM_TRIGGER_COUNT} vi phạm** liên tiếp trong vòng 1 phút!\n\n` +
      `> 🔴 Bot chuyển sang **chế độ nghiêm túc** trong **5 phút**\n` +
      `> 🗑️ Mọi tin nhắn vi phạm sẽ bị xoá **ngay lập tức**\n` +
      `> 🐢 Tin nhắn quá nhanh (< 5 giây) sẽ bị cảnh báo slow mode\n` +
      `> 🙏 Vui lòng giữ thái độ bình tĩnh và lịch sự`
    )
    .setColor(0xff8c00)
    .setThumbnail("https://cdn.discordapp.com/emojis/1234567890.png") // tuỳ chỉnh
    .setFooter({ text: "Calm Mode tự tắt sau 5 phút • Hyggshi OS Bot" })
    .setTimestamp();

  await channel.send({ embeds: [onEmbed] }).catch(() => {});

  // Auto-tắt sau 5 phút
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    state.activatedAt = null;
    state.timer       = null;
    state.violations  = [];
    state.warnCooldown.clear();
    state.slowMode.clear();
    console.log(`[Calm Mode] 🟢 Tắt tại guild ${guildId}`);

    const offEmbed = new EmbedBuilder()
      .setTitle("✅ Calm Mode — Đã tắt")
      .setDescription(
        `Chế độ nghiêm túc đã kết thúc sau **5 phút**.\n` +
        `Cảm ơn mọi người đã giữ bình tĩnh và lịch sự! 😊🎉`
      )
      .setColor(0x00c851)
      .setTimestamp();

    await channel.send({ embeds: [offEmbed] }).catch(() => {});
  }, CALM_MODE_DURATION);
}

/** Ghi nhận vi phạm và kiểm tra có nên bật Calm Mode không */
async function recordViolation(guildId, channel) {
  const state = getCalmState(guildId);
  const now   = Date.now();

  state.violations = state.violations.filter(t => now - t < CALM_WINDOW_MS);
  state.violations.push(now);

  console.log(`[Calm Mode] Guild ${guildId} — ${state.violations.length}/${CALM_TRIGGER_COUNT} vi phạm`);

  if (state.violations.length >= CALM_TRIGGER_COUNT && !state.activatedAt) {
    await activateCalmMode(guildId, channel);
  }
}

/**
 * Xử lý tin nhắn trong Calm Mode:
 * - Slow mode: xoá tin nếu nhắn quá nhanh (< 5 giây)
 * - Nhắc nhở: gửi embed nhắc bình tĩnh (có cooldown 15 giây/user)
 * @returns {boolean} true nếu tin nhắn đã bị can thiệp (xoá)
 */
async function handleCalmModeMessage(msg) {
  if (!msg.guild || !isCalmMode(msg.guild.id)) return false;

  const state    = getCalmState(msg.guild.id);
  const now      = Date.now();
  const userId   = msg.author.id;
  const remaining = calmModeRemaining(msg.guild.id);

  // --- Slow mode: giới hạn 1 tin / 5 giây ---
  const lastMsg = state.slowMode.get(userId) || 0;
  if (now - lastMsg < 5000) {
    try { await msg.delete(); } catch (_) {}
    // Chỉ gửi cảnh báo slow mode nếu chưa gửi gần đây
    const lastWarn = state.warnCooldown.get(userId + "_slow") || 0;
    if (now - lastWarn > CALM_WARN_COOLDOWN) {
      state.warnCooldown.set(userId + "_slow", now);
      await msg.channel.send({
        content: `${msg.author}`,
        embeds: [
          new EmbedBuilder()
            .setTitle("🐢 Slow Mode")
            .setDescription(
              `Bạn đang nhắn quá nhanh!\n` +
              `> Calm Mode đang hoạt động — vui lòng chờ **5 giây** giữa mỗi tin nhắn.\n` +
              `> Còn **${remaining} giây** nữa Calm Mode sẽ tắt.`
            )
            .setColor(0xffa500)
            .setFooter({ text: "Hyggshi OS Bot • Calm Mode" })
        ]
      }).catch(() => {});
    }
    return true; // Đã can thiệp (xoá)
  }
  state.slowMode.set(userId, now);

  // --- Nhắc nhở nếu tin nhắn "nóng" (nhiều ! hoặc caps) ---
  const isHot = (msg.content.includes("!") || msg.content === msg.content.toUpperCase())
    && msg.content.length > 3;

  if (isHot) {
    const lastWarn = state.warnCooldown.get(userId) || 0;
    if (now - lastWarn > CALM_WARN_COOLDOWN) {
      state.warnCooldown.set(userId, now);
      await msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🧘 Calm Mode đang hoạt động")
            .setDescription(
              `Server đang ở chế độ nghiêm túc.\n` +
              `> Hãy giữ bình tĩnh và trao đổi lịch sự nhé.\n` +
              `> Còn **${remaining} giây** nữa sẽ kết thúc. 🙏`
            )
            .setColor(0xff8c00)
            .setFooter({ text: "Hyggshi OS Bot • Calm Mode" })
        ]
      }).catch(() => {});
    }
  }

  return false;
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
      ),
    new SlashCommandBuilder().setName("calmstatus").setDescription("Kiểm tra trạng thái Calm Mode"),
    new SlashCommandBuilder()
      .setName("clear")
      .setDescription("🗑️ Xoá tin nhắn trong kênh")
      .addIntegerOption(o =>
        o.setName("amount")
          .setDescription("Số tin nhắn muốn xoá (1–100)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      )
      .addChannelOption(o =>
        o.setName("channel")
          .setDescription("Kênh muốn xoá (để trống = kênh hiện tại)")
          .setRequired(false)
      )
      .addBooleanOption(o =>
        o.setName("old")
          .setDescription("Xoá cả tin nhắn cũ hơn 14 ngày? (chậm hơn, xoá từng cái)")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("clearimage")
      .setDescription("🖼️ Xoá tin nhắn chứa ảnh/file trong kênh")
      .addIntegerOption(o =>
        o.setName("amount")
          .setDescription("Số tin nhắn muốn quét để tìm ảnh (1–100)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      )
      .addChannelOption(o =>
        o.setName("channel")
          .setDescription("Kênh muốn xoá ảnh (để trống = kênh hiện tại)")
          .setRequired(false)
      )
      .addBooleanOption(o =>
        o.setName("old")
          .setDescription("Xoá cả ảnh trong tin nhắn cũ hơn 14 ngày? (chậm hơn)")
          .setRequired(false)
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

  // ⚡ Defer ngay lập tức để tránh timeout 3 giây của Discord
  // Với các lệnh nhanh, editReply() sẽ thay thế "đang xử lý..."
  try {
    await interaction.deferReply();
  } catch (e) {
    // Nếu defer lỗi (VD: đã timeout), bỏ qua lệnh này hoàn toàn
    console.warn(`⚠️ [Defer] Không thể defer interaction "${commandName}": ${e.message}`);
    return;
  }

  // Helper: editReply thay vì reply (vì đã defer)
  const send = (payload) => {
    if (typeof payload === "string") return interaction.editReply({ content: payload });
    return interaction.editReply(payload);
  };
  const sendEphemeral = (payload) => {
    // Sau khi defer public, không thể đổi ephemeral — gửi followUp thay
    // Dùng MessageFlags.Ephemeral thay vì ephemeral:true (đã deprecated)
    if (typeof payload === "string") return interaction.followUp({ content: payload, flags: MessageFlags.Ephemeral });
    return interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
  };

  try {

  if (commandName === "ping")
    return send(`🏓 Pong! 🏓 Ping: ${Date.now() - interaction.createdTimestamp} ms`);

  if (commandName === "status")
    return send(`🟢 Online\n⏱️ ${m} phút ${s} giây`);

  if (commandName === "info")
    return send("🤖 **Hyggshi OS Bot**\nDev: Nguyễn Minh Phúc");

  if (commandName === "help")
    return send("📋 `/ping /status /info /help /server /user /avatar /hug /roll /flip /uptime /calmstatus`");

  if (commandName === "server") {
    const g = interaction.guild;
    return send(`🏠 ${g.name}\n👥 ${g.memberCount}`);
  }

  if (commandName === "user") {
    const u = interaction.user;
    return send(`👤 ${u.tag}\n🆔 ${u.id}`);
  }

  if (commandName === "members")
    return send(`👥 ${interaction.guild.memberCount}`);

  if (commandName === "botinfo")
    return send(`🤖 Hyggshi OS Bot\n⏱️ ${h}h ${m}m ${s}s`);

  if (commandName === "github")
    return send("🔗 https://github.com/HyggshiOSDeveloper/Hyggshi-OS-project-center");

  if (commandName === "say") {
    const sayMsg = interaction.options.getString("message") || "";
    const sayImage = interaction.options.getAttachment("image");

    // Phải có ít nhất message hoặc ảnh
    if (!sayMsg && !sayImage) {
      return sendEphemeral("⚠️ Bạn cần nhập nội dung hoặc đính kèm ảnh!");
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
        return sendEphemeral("🛡️ Chỉ được đính kèm file ảnh (PNG, JPG, GIF, WEBP)!");
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

    return send(replyPayload);
  }

  if (commandName === "roll")
    return send(`🎲 ${Math.floor(Math.random() * 100) + 1}`);

  if (commandName === "flip")
    return send(`💰 ${Math.random() < 0.5 ? "Heads" : "Tails"}`);

  if (commandName === "uptime")
    return send(`🕒 ${h}h ${m}m ${s}s`);

  if (commandName === "avatar") {
    const u = interaction.options.getUser("target") || interaction.user;
    return send({
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
    return send(`🤗 ${interaction.user} ôm ${t}`);
  }

  if (commandName === "calmstatus") {
    const guildId = interaction.guild?.id;
    if (!guildId) return sendEphemeral("⚠️ Lệnh này chỉ dùng trong server!");

    const active    = isCalmMode(guildId);
    const remaining = calmModeRemaining(guildId);
    const state     = getCalmState(guildId);

    const embed = new EmbedBuilder()
      .setTitle("🧘 Calm Mode — Trạng thái")
      .addFields(
        { name: "Trạng thái",       value: active ? "🔴 Đang hoạt động" : "🟢 Tắt",                       inline: true },
        { name: "Thời gian còn lại", value: active ? `${remaining} giây` : "—",                            inline: true },
        { name: "Vi phạm gần đây",   value: `${state.violations.length}/${CALM_TRIGGER_COUNT} (trong 1 phút)`, inline: true }
      )
      .setColor(active ? 0xff8c00 : 0x00c851)
      .setFooter({ text: "Calm Mode kích hoạt khi có 3 vi phạm trong 1 phút • Hyggshi OS Bot" })
      .setTimestamp();

    return send({ embeds: [embed] });
  }

  if (commandName === "clear") {
    // Chỉ cho phép người có quyền Manage Messages
    if (!interaction.member.permissions.has("ManageMessages")) {
      return sendEphemeral("🚫 Bạn không có quyền **Quản lý tin nhắn** để dùng lệnh này!");
    }

    const amount    = interaction.options.getInteger("amount");
    const target    = interaction.options.getChannel("channel") || interaction.channel;
    const allowOld  = interaction.options.getBoolean("old") ?? false;

    // Kiểm tra bot có quyền trong kênh đích không
    const botMember = interaction.guild.members.me;
    if (!target.permissionsFor(botMember).has("ManageMessages")) {
      return sendEphemeral(`🚫 Bot không có quyền **Quản lý tin nhắn** trong <#${target.id}>!`);
    }

    let deleted   = 0;
    let skipped   = 0;
    let mode      = "bulk"; // "bulk" | "single"

    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

    try {
      const fetched = await target.messages.fetch({ limit: amount });

      if (!allowOld) {
        // ── Chế độ mặc định: bulk delete (chỉ tin < 14 ngày) ──
        const deletable = fetched.filter(m => m.createdTimestamp > twoWeeksAgo);
        skipped = fetched.size - deletable.size;

        if (deletable.size === 0) {
          return sendEphemeral(
            `⚠️ Tất cả ${fetched.size} tin nhắn đều cũ hơn 14 ngày!
` +
            `> Dùng \`old: True\` để xoá từng cái (chậm hơn).`
          );
        }

        const result = await target.bulkDelete(deletable, true);
        deleted = result.size;
        mode    = "bulk";

      } else {
        // ── Chế độ old: xoá từng cái, kể cả tin > 14 ngày ──
        mode = "single";

        // Thông báo tiến trình vì sẽ mất thời gian
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("⏳ Đang xoá tin nhắn cũ...")
              .setDescription(
                `Đang xoá **${fetched.size}** tin nhắn trong <#${target.id}> (bao gồm tin cũ hơn 14 ngày).
` +
                `> Quá trình này có thể mất vài giây, vui lòng chờ...`
              )
              .setColor(0xffa500)
          ]
        });

        // Xoá từng tin, delay 500ms/cái để tránh rate limit
        for (const [, msg] of fetched) {
          try {
            await msg.delete();
            deleted++;
          } catch (e) {
            // Có thể đã bị xoá hoặc không có quyền
            skipped++;
            console.warn(`[Clear/old] Bỏ qua tin nhắn ${msg.id}: ${e.message}`);
          }
          // Delay 600ms giữa mỗi lần xoá để tránh rate limit Discord (5 req/s)
          await new Promise(r => setTimeout(r, 600));
        }
      }

    } catch (e) {
      console.error("[Clear] Lỗi khi xoá:", e.message);
      return sendEphemeral(`❌ Xoá thất bại: ${e.message}`);
    }

    // Embed kết quả
    const resultEmbed = new EmbedBuilder()
      .setTitle("🗑️ Đã xoá tin nhắn")
      .addFields(
        { name: "Kênh",        value: `<#${target.id}>`,                                    inline: true },
        { name: "Đã xoá",      value: `${deleted} tin nhắn`,                                inline: true },
        { name: "Bỏ qua",      value: skipped > 0 ? `${skipped} tin` : "Không có",          inline: true },
        { name: "Chế độ",      value: mode === "bulk" ? "⚡ Bulk (nhanh)" : "🐢 Từng cái (hỗ trợ tin cũ)", inline: true },
        { name: "Thực hiện",   value: `${interaction.user}`,                                 inline: true }
      )
      .setColor(0xff4444)
      .setFooter({ text: "Hyggshi OS Bot • Clear" })
      .setTimestamp();

    if (target.id !== interaction.channel.id) {
      await target.send({ embeds: [resultEmbed] }).catch(() => {});
    }
    return send({ embeds: [resultEmbed] });
  }

  if (commandName === "clearimage") {
    // Chỉ cho phép người có quyền Manage Messages
    if (!interaction.member.permissions.has("ManageMessages")) {
      return sendEphemeral("🚫 Bạn không có quyền **Quản lý tin nhắn** để dùng lệnh này!");
    }

    const amount   = interaction.options.getInteger("amount");
    const target   = interaction.options.getChannel("channel") || interaction.channel;
    const allowOld = interaction.options.getBoolean("old") ?? false;

    // Kiểm tra quyền bot
    const botMember = interaction.guild.members.me;
    if (!target.permissionsFor(botMember).has("ManageMessages")) {
      return sendEphemeral(`🚫 Bot không có quyền **Quản lý tin nhắn** trong <#${target.id}>!`);
    }

    // Fetch tin nhắn
    const fetched = await target.messages.fetch({ limit: amount });

    // Lọc chỉ tin nhắn có ảnh hoặc file đính kèm
    const hasMedia = m =>
      m.attachments.size > 0 ||
      m.embeds.some(e => e.image || e.thumbnail || e.type === "image");

    const twoWeeksAgo   = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const mediaMsgs     = fetched.filter(hasMedia);
    const totalScanned  = fetched.size;

    if (mediaMsgs.size === 0) {
      return sendEphemeral(
        `🔍 Đã quét **${totalScanned}** tin nhắn trong <#${target.id}> nhưng **không tìm thấy ảnh/file** nào.`
      );
    }

    let deleted = 0;
    let skipped = 0;
    let mode    = "bulk";

    // Thông báo tiến trình
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔍 Đang tìm và xoá ảnh...")
          .setDescription(
            `Tìm thấy **${mediaMsgs.size} tin nhắn có ảnh/file** trong <#${target.id}>.
` +
            `> Đang xoá, vui lòng chờ...`
          )
          .setColor(0xffa500)
      ]
    });

    if (!allowOld) {
      // ── Bulk delete: chỉ tin < 14 ngày ──
      mode = "bulk";
      const deletable = mediaMsgs.filter(m => m.createdTimestamp > twoWeeksAgo);
      skipped = mediaMsgs.size - deletable.size;

      if (deletable.size === 0) {
        return send({
          embeds: [
            new EmbedBuilder()
              .setTitle("⚠️ Không thể xoá")
              .setDescription(
                `Tất cả **${mediaMsgs.size}** tin nhắn có ảnh đều cũ hơn 14 ngày.
` +
                `> Dùng \`old: True\` để xoá từng cái.`
              )
              .setColor(0xffa500)
          ]
        });
      }

      try {
        const result = await target.bulkDelete(deletable, true);
        deleted = result.size;
      } catch (e) {
        console.error("[ClearImage/bulk] Lỗi:", e.message);
        return sendEphemeral(`❌ Xoá thất bại: ${e.message}`);
      }

    } else {
      // ── Single delete: xoá từng cái, kể cả tin cũ ──
      mode = "single";
      for (const [, msg] of mediaMsgs) {
        try {
          await msg.delete();
          deleted++;
        } catch (e) {
          skipped++;
          console.warn(`[ClearImage/old] Bỏ qua ${msg.id}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 600)); // tránh rate limit
      }
    }

    // Embed kết quả
    const resultEmbed = new EmbedBuilder()
      .setTitle("🖼️ Đã xoá ảnh/file")
      .addFields(
        { name: "Kênh",         value: `<#${target.id}>`,                                            inline: true },
        { name: "Đã quét",      value: `${totalScanned} tin nhắn`,                                   inline: true },
        { name: "Có ảnh/file",  value: `${mediaMsgs.size} tin`,                                      inline: true },
        { name: "Đã xoá",       value: `${deleted} tin`,                                             inline: true },
        { name: "Bỏ qua",       value: skipped > 0 ? `${skipped} tin` : "Không có",                  inline: true },
        { name: "Chế độ",       value: mode === "bulk" ? "⚡ Bulk (nhanh)" : "🐢 Từng cái (tin cũ)", inline: true },
        { name: "Thực hiện",    value: `${interaction.user}`,                                         inline: true }
      )
      .setColor(0xff4444)
      .setFooter({ text: "Hyggshi OS Bot • ClearImage" })
      .setTimestamp();

    if (target.id !== interaction.channel.id) {
      await target.send({ embeds: [resultEmbed] }).catch(() => {});
    }
    return send({ embeds: [resultEmbed] });
  }

  } catch (err) {
    // Bắt mọi lỗi trong quá trình xử lý lệnh
    if (!isIgnorableError(err)) {
      console.error(`❌ [Slash] Lỗi lệnh /${commandName}:`, err);
    }
    try {
      await interaction.editReply("⚠️ Có lỗi xảy ra khi xử lý lệnh. Vui lòng thử lại.");
    } catch (_) {}
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
    try { await msg.delete(); } catch (_) {}

    // 🧘 Calm Mode — ghi nhận vi phạm (kể cả khi đang calm mode để reset timer)
    if (msg.guild) await recordViolation(msg.guild.id, msg.channel);
    return;
  }

  // 🧘 Calm Mode — xử lý slow mode & nhắc nhở
  const wasHandled = await handleCalmModeMessage(msg);
  if (wasHandled) return; // Tin nhắn đã bị xoá (slow mode)

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
// Danh sách lỗi Discord API không nghiêm trọng — KHÔNG crash bot
const IGNORABLE_DISCORD_CODES = [
  10062, // Unknown interaction (bot reply quá chậm, timeout 3s)
  10008, // Unknown message (tin nhắn đã bị xoá trước khi bot xử lý)
  50013, // Missing Permissions
  40060, // Interaction already acknowledged
];

function isIgnorableError(err) {
  return err?.code && IGNORABLE_DISCORD_CODES.includes(err.code);
}

process.on("unhandledRejection", err => {
  if (isIgnorableError(err)) {
    console.warn(`⚠️ [Discord] Bỏ qua lỗi nhẹ: [${err.code}] ${err.message}`);
    return;
  }
  console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", err => {
  if (isIgnorableError(err)) {
    // Lỗi 10062 = interaction timeout — bình thường khi Render khởi động chậm
    console.warn(`⚠️ [Discord] Bỏ qua uncaughtException nhẹ: [${err.code}] ${err.message}`);
    return; // KHÔNG exit(1) — giữ bot sống
  }
  console.error("❌ Uncaught Exception nghiêm trọng:", err);
  process.exit(1);
});

// ================== LOGIN ==================
client.login(TOKEN).catch(err => {
  console.error("❌ Login thất bại:", err.message);
  process.exit(1);
});
