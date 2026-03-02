require("dotenv").config();
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
} = require("discord.js");

const { pool, initDatabase } = require("./database");

// ================== ENV ==================
const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID || process.env.CLIENT_ID;
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

const RENDER_URL = process.env.RENDER_URL;

if (RENDER_URL) {
  setInterval(() => {
    const url = new URL(RENDER_URL + "/ping");
    const mod = url.protocol === "https:" ? https : http;
    mod.get(url.toString(), (res) => {
      console.log(`🔁 Self-ping: ${res.statusCode}`);
    }).on("error", (err) => {
      console.error("❌ Self-ping lỗi:", err.message);
    });
  }, 4 * 60 * 1000);
} else {
  console.warn("⚠️ Chưa set RENDER_URL, bot có thể bị sleep!");
}

// ================== SAFETY FILTER LAYER ==================
const BLOCKED_WORDS = [
  "đụ", "địt", "lồn", "cặc", "dái", "đĩ", "vãi", "cứt", "đéo", "mẹ kiếp",
  "con chó", "thằng chó", "đồ chó", "đồ điên", "mẹ mày", "bố mày", "má mày",
  "fuck", "shit", "bitch", "ass", "damn", "crap", "bastard", "dick", "cock",
  "pussy", "whore", "slut", "nigga", "nigger", "wtf", "stfu",
  "tao giết mày", "tao đánh mày", "tao chém", "tao bắn", "tao đốt",
  "i will kill", "i'll kill", "i will hurt", "gonna kill", "kms", "kill yourself",
  "tự tử", "treo cổ", "nhảy lầu", "uống thuốc ngủ",
  "hate you", "die", "go die", "chết đi", "mày chết đi"
];

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
    await target.editReply({ embeds: [embed] }).catch(() => {});
  }
}

// ================== CALM MODE ==================
const CALM_MODE_DURATION = 5 * 60 * 1000;
const CALM_TRIGGER_COUNT = 3;
const CALM_WINDOW_MS     = 60 * 1000;
const CALM_WARN_COOLDOWN = 15 * 1000;

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

function isCalmMode(guildId) {
  return getCalmState(guildId).activatedAt !== null;
}

function calmModeRemaining(guildId) {
  const state = getCalmState(guildId);
  if (!state.activatedAt) return 0;
  return Math.max(0, Math.ceil((CALM_MODE_DURATION - (Date.now() - state.activatedAt)) / 1000));
}

async function activateCalmMode(guildId, channel) {
  const state = getCalmState(guildId);
  if (state.activatedAt) return;

  state.activatedAt = Date.now();
  state.violations  = [];
  state.warnCooldown.clear();
  state.slowMode.clear();
  console.log(`[Calm Mode] 🔴 Kích hoạt tại guild ${guildId}`);

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
    .setFooter({ text: "Calm Mode tự tắt sau 5 phút • Hyggshi OS Bot" })
    .setTimestamp();

  await channel.send({ embeds: [onEmbed] }).catch(() => {});

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

async function handleCalmModeMessage(msg) {
  if (!msg.guild || !isCalmMode(msg.guild.id)) return false;

  const state     = getCalmState(msg.guild.id);
  const now       = Date.now();
  const userId    = msg.author.id;
  const remaining = calmModeRemaining(msg.guild.id);

  const lastMsg = state.slowMode.get(userId) || 0;
  if (now - lastMsg < 5000) {
    try { await msg.delete(); } catch (_) {}
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
    return true;
  }
  state.slowMode.set(userId, now);

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

// ================== ANTI RAID ==================
let joinTracker = [];

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

  await initDatabase();

  client.user.setPresence({
    status: "online",
    activities: [{ name: "meo | /help", type: 3 }]
  });

  // ── Auto Unban (tạm thời) ──
  setInterval(async () => {
    const now = Date.now();
    try {
      const { rows } = await pool.query(
        `SELECT * FROM bans WHERE expiresAt IS NOT NULL AND expiresAt <= $1`,
        [now]
      );
      for (const row of rows) {
        const guild = client.guilds.cache.get(row.guildid);
        if (!guild) continue;
        try { await guild.members.unban(row.userid); } catch (_) {}
        await pool.query(
          `DELETE FROM bans WHERE userid = $1 AND guildid = $2`,
          [row.userid, row.guildid]
        );
      }
    } catch (e) {
      console.error("[AutoUnban] Lỗi:", e.message);
    }
  }, 60000);

  // ── Auto Reset Warn (30 ngày) ──
  setInterval(async () => {
    const THIRTY = 30 * 24 * 60 * 60 * 1000;
    const limit  = Date.now() - THIRTY;
    try {
      await pool.query(`DELETE FROM warns WHERE timestamp <= $1`, [limit]);
    } catch (e) {
      console.error("[AutoResetWarn] Lỗi:", e.message);
    }
  }, 3600000);

  const commands = [
    // ── Lệnh cũ ──
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
      ),

    // ── Lệnh mới (moderation) ──
    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban thành viên")
      .addUserOption(o => o.setName("target").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Lý do"))
      .addStringOption(o => o.setName("duration").setDescription("10m | 1h | 1d")),

    new SlashCommandBuilder()
      .setName("unban")
      .setDescription("Gỡ ban")
      .addUserOption(o => o.setName("target").setDescription("User").setRequired(true)),

    new SlashCommandBuilder()
      .setName("banlist")
      .setDescription("Xem danh sách ban"),

    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Cảnh cáo thành viên")
      .addUserOption(o => o.setName("target").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Lý do").setRequired(true)),

    new SlashCommandBuilder()
      .setName("warnlist")
      .setDescription("Xem cảnh cáo của thành viên")
      .addUserOption(o => o.setName("target").setDescription("User").setRequired(true)),

    new SlashCommandBuilder()
      .setName("clearwarn")
      .setDescription("Xoá toàn bộ cảnh cáo của thành viên")
      .addUserOption(o => o.setName("target").setDescription("User").setRequired(true))

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

  try {
    await interaction.deferReply();
  } catch (e) {
    console.warn(`⚠️ [Defer] Không thể defer interaction "${commandName}": ${e.message}`);
    return;
  }

  const send = (payload) => {
    if (typeof payload === "string") return interaction.editReply({ content: payload });
    return interaction.editReply(payload);
  };
  const sendEphemeral = (payload) => {
    if (typeof payload === "string") return interaction.followUp({ content: payload, flags: MessageFlags.Ephemeral });
    return interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
  };

  try {

    // ── Lệnh cũ ──

    if (commandName === "ping")
      return send(`🏓 Pong! 🏓 Ping: ${Date.now() - interaction.createdTimestamp} ms`);

    if (commandName === "status")
      return send(`🟢 Online\n⏱️ ${m} phút ${s} giây`);

    if (commandName === "info")
      return send("🤖 **Hyggshi OS Bot**\nDev: Nguyễn Minh Phúc");

    if (commandName === "help")
      return send("📋 `/ping /status /info /help /server /user /avatar /hug /roll /flip /uptime /calmstatus /ban /unban /banlist /warn /warnlist /clearwarn`");

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
      const sayMsg   = interaction.options.getString("message") || "";
      const sayImage = interaction.options.getAttachment("image");

      if (!sayMsg && !sayImage) {
        return sendEphemeral("⚠️ Bạn cần nhập nội dung hoặc đính kèm ảnh!");
      }

      if (sayMsg) {
        const sayCheck = safetyCheck(sayMsg);
        if (sayCheck.blocked) {
          console.log(`🛡️ [Safety] /say bị chặn bởi ${interaction.user.tag}: "${sayMsg}"`);
          return sendSafetyWarning(interaction, sayCheck.matched, "command");
        }
      }

      if (sayImage) {
        const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
        if (!allowedTypes.includes(sayImage.contentType)) {
          return sendEphemeral("🛡️ Chỉ được đính kèm file ảnh (PNG, JPG, GIF, WEBP)!");
        }
      }

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
          { name: "Trạng thái",        value: active ? "🔴 Đang hoạt động" : "🟢 Tắt",                        inline: true },
          { name: "Thời gian còn lại",  value: active ? `${remaining} giây` : "—",                             inline: true },
          { name: "Vi phạm gần đây",    value: `${state.violations.length}/${CALM_TRIGGER_COUNT} (trong 1 phút)`, inline: true }
        )
        .setColor(active ? 0xff8c00 : 0x00c851)
        .setFooter({ text: "Calm Mode kích hoạt khi có 3 vi phạm trong 1 phút • Hyggshi OS Bot" })
        .setTimestamp();

      return send({ embeds: [embed] });
    }

    if (commandName === "clear") {
      if (!interaction.member.permissions.has("ManageMessages")) {
        return sendEphemeral("🚫 Bạn không có quyền **Quản lý tin nhắn** để dùng lệnh này!");
      }

      const amount   = interaction.options.getInteger("amount");
      const target   = interaction.options.getChannel("channel") || interaction.channel;
      const allowOld = interaction.options.getBoolean("old") ?? false;

      const botMember = interaction.guild.members.me;
      if (!target.permissionsFor(botMember).has("ManageMessages")) {
        return sendEphemeral(`🚫 Bot không có quyền **Quản lý tin nhắn** trong <#${target.id}>!`);
      }

      let deleted = 0;
      let skipped = 0;
      let mode    = "bulk";

      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

      try {
        const fetched = await target.messages.fetch({ limit: amount });

        if (!allowOld) {
          const deletable = fetched.filter(msg => msg.createdTimestamp > twoWeeksAgo);
          skipped = fetched.size - deletable.size;

          if (deletable.size === 0) {
            return sendEphemeral(
              `⚠️ Tất cả ${fetched.size} tin nhắn đều cũ hơn 14 ngày!\n` +
              `> Dùng \`old: True\` để xoá từng cái (chậm hơn).`
            );
          }

          const result = await target.bulkDelete(deletable, true);
          deleted = result.size;
          mode    = "bulk";

        } else {
          mode = "single";

          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle("⏳ Đang xoá tin nhắn cũ...")
                .setDescription(
                  `Đang xoá **${fetched.size}** tin nhắn trong <#${target.id}> (bao gồm tin cũ hơn 14 ngày).\n` +
                  `> Quá trình này có thể mất vài giây, vui lòng chờ...`
                )
                .setColor(0xffa500)
            ]
          });

          for (const [, msg] of fetched) {
            try {
              await msg.delete();
              deleted++;
            } catch (e) {
              skipped++;
              console.warn(`[Clear/old] Bỏ qua tin nhắn ${msg.id}: ${e.message}`);
            }
            await new Promise(r => setTimeout(r, 600));
          }
        }

      } catch (e) {
        console.error("[Clear] Lỗi khi xoá:", e.message);
        return sendEphemeral(`❌ Xoá thất bại: ${e.message}`);
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🗑️ Đã xoá tin nhắn")
        .addFields(
          { name: "Kênh",      value: `<#${target.id}>`,                                                 inline: true },
          { name: "Đã xoá",    value: `${deleted} tin nhắn`,                                             inline: true },
          { name: "Bỏ qua",    value: skipped > 0 ? `${skipped} tin` : "Không có",                      inline: true },
          { name: "Chế độ",    value: mode === "bulk" ? "⚡ Bulk (nhanh)" : "🐢 Từng cái (hỗ trợ tin cũ)", inline: true },
          { name: "Thực hiện", value: `${interaction.user}`,                                              inline: true }
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
      if (!interaction.member.permissions.has("ManageMessages")) {
        return sendEphemeral("🚫 Bạn không có quyền **Quản lý tin nhắn** để dùng lệnh này!");
      }

      const amount   = interaction.options.getInteger("amount");
      const target   = interaction.options.getChannel("channel") || interaction.channel;
      const allowOld = interaction.options.getBoolean("old") ?? false;

      const botMember = interaction.guild.members.me;
      if (!target.permissionsFor(botMember).has("ManageMessages")) {
        return sendEphemeral(`🚫 Bot không có quyền **Quản lý tin nhắn** trong <#${target.id}>!`);
      }

      const fetched = await target.messages.fetch({ limit: amount });

      const hasMedia = msg =>
        msg.attachments.size > 0 ||
        msg.embeds.some(e => e.image || e.thumbnail || e.type === "image");

      const twoWeeksAgo  = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const mediaMsgs    = fetched.filter(hasMedia);
      const totalScanned = fetched.size;

      if (mediaMsgs.size === 0) {
        return sendEphemeral(
          `🔍 Đã quét **${totalScanned}** tin nhắn trong <#${target.id}> nhưng **không tìm thấy ảnh/file** nào.`
        );
      }

      let deleted = 0;
      let skipped = 0;
      let mode    = "bulk";

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔍 Đang tìm và xoá ảnh...")
            .setDescription(
              `Tìm thấy **${mediaMsgs.size} tin nhắn có ảnh/file** trong <#${target.id}>.\n` +
              `> Đang xoá, vui lòng chờ...`
            )
            .setColor(0xffa500)
        ]
      });

      if (!allowOld) {
        mode = "bulk";
        const deletable = mediaMsgs.filter(msg => msg.createdTimestamp > twoWeeksAgo);
        skipped = mediaMsgs.size - deletable.size;

        if (deletable.size === 0) {
          return send({
            embeds: [
              new EmbedBuilder()
                .setTitle("⚠️ Không thể xoá")
                .setDescription(
                  `Tất cả **${mediaMsgs.size}** tin nhắn có ảnh đều cũ hơn 14 ngày.\n` +
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
        mode = "single";
        for (const [, msg] of mediaMsgs) {
          try {
            await msg.delete();
            deleted++;
          } catch (e) {
            skipped++;
            console.warn(`[ClearImage/old] Bỏ qua ${msg.id}: ${e.message}`);
          }
          await new Promise(r => setTimeout(r, 600));
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🖼️ Đã xoá ảnh/file")
        .addFields(
          { name: "Kênh",        value: `<#${target.id}>`,                                             inline: true },
          { name: "Đã quét",     value: `${totalScanned} tin nhắn`,                                    inline: true },
          { name: "Có ảnh/file", value: `${mediaMsgs.size} tin`,                                       inline: true },
          { name: "Đã xoá",      value: `${deleted} tin`,                                              inline: true },
          { name: "Bỏ qua",      value: skipped > 0 ? `${skipped} tin` : "Không có",                  inline: true },
          { name: "Chế độ",      value: mode === "bulk" ? "⚡ Bulk (nhanh)" : "🐢 Từng cái (tin cũ)", inline: true },
          { name: "Thực hiện",   value: `${interaction.user}`,                                         inline: true }
        )
        .setColor(0xff4444)
        .setFooter({ text: "Hyggshi OS Bot • ClearImage" })
        .setTimestamp();

      if (target.id !== interaction.channel.id) {
        await target.send({ embeds: [resultEmbed] }).catch(() => {});
      }
      return send({ embeds: [resultEmbed] });
    }

    // ── Lệnh mới (moderation) ──

    if (commandName === "ban") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return sendEphemeral("🚫 Bạn không có quyền **Ban thành viên**!");

      const target   = interaction.options.getUser("target");
      const reason   = interaction.options.getString("reason") || "Không có lý do";
      const duration = interaction.options.getString("duration");

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member?.bannable) return sendEphemeral("🚫 Không thể ban thành viên này.");

      let expiresAt = null;

      if (duration) {
        const match = duration.match(/^(\d+)(m|h|d)$/);
        if (!match) return sendEphemeral("⚠️ Format thời gian không hợp lệ. Dùng: `10m` | `1h` | `1d`");

        const value = parseInt(match[1]);
        const unit  = match[2];
        const ms    =
          unit === "m" ? value * 60000 :
          unit === "h" ? value * 3600000 :
          value * 86400000;

        expiresAt = Date.now() + ms;
      }

      try {
        await target.send(`⛔ Bạn đã bị ban khỏi **${interaction.guild.name}**\nLý do: ${reason}`);
      } catch (_) {}

      await member.ban({ reason });

      await pool.query(
        `INSERT INTO bans (userId, guildId, reason, expiresAt) VALUES ($1, $2, $3, $4)`,
        [target.id, interaction.guild.id, reason, expiresAt]
      );

      const banEmbed = new EmbedBuilder()
        .setTitle("⛔ Ban thành công")
        .addFields(
          { name: "Thành viên", value: `${target.tag}`,                                           inline: true },
          { name: "Lý do",      value: reason,                                                     inline: true },
          { name: "Thời hạn",   value: expiresAt ? `<t:${Math.floor(expiresAt/1000)}:R>` : "Vĩnh viễn", inline: true }
        )
        .setColor(0xff0000)
        .setFooter({ text: "Hyggshi OS Bot • Ban" })
        .setTimestamp();

      return send({ embeds: [banEmbed] });
    }

    if (commandName === "unban") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return sendEphemeral("🚫 Bạn không có quyền **Ban thành viên**!");

      const target = interaction.options.getUser("target");

      await interaction.guild.members.unban(target.id).catch(() => null);

      await pool.query(
        `DELETE FROM bans WHERE userId=$1 AND guildId=$2`,
        [target.id, interaction.guild.id]
      );

      return send(`✅ Đã unban **${target.tag}**.`);
    }

    if (commandName === "banlist") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return sendEphemeral("🚫 Bạn không có quyền xem danh sách ban!");

      const { rows } = await pool.query(
        `SELECT * FROM bans WHERE guildId=$1`,
        [interaction.guild.id]
      );

      if (!rows.length) return send("✅ Không có ai đang bị ban.");

      let desc = "";
      for (const row of rows) {
        const type = row.expiresat
          ? `<t:${Math.floor(row.expiresat/1000)}:R>`
          : "Vĩnh viễn";
        desc += `<@${row.userid}> — ${type}\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle("📋 Danh sách Ban")
        .setDescription(desc)
        .setColor(0xff4444)
        .setFooter({ text: "Hyggshi OS Bot • Ban List" })
        .setTimestamp();

      return send({ embeds: [embed] });
    }

    if (commandName === "warn") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return sendEphemeral("🚫 Bạn không có quyền **Cảnh cáo thành viên**!");

      const target = interaction.options.getUser("target");
      const reason = interaction.options.getString("reason");

      await pool.query(
        `INSERT INTO warns (userId, guildId, moderatorId, reason, timestamp) VALUES ($1, $2, $3, $4, $5)`,
        [target.id, interaction.guild.id, interaction.user.id, reason, Date.now()]
      );

      const { rows } = await pool.query(
        `SELECT * FROM warns WHERE userId=$1 AND guildId=$2`,
        [target.id, interaction.guild.id]
      );

      const count = rows.length;

      try {
        await target.send(`⚠️ Bạn bị warn tại **${interaction.guild.name}**\nLý do: ${reason}\nTổng warn: ${count}`);
      } catch (_) {}

      // Auto-ban nếu đủ 3 warn
      if (count >= 3) {
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (member?.bannable) {
          await member.ban({ reason: "Tự động ban: đủ 3 cảnh cáo" });
          await pool.query(
            `INSERT INTO bans (userId, guildId, reason, expiresAt) VALUES ($1, $2, $3, $4)`,
            [target.id, interaction.guild.id, "Tự động ban: đủ 3 cảnh cáo", null]
          );
        }
      }

      const warnEmbed = new EmbedBuilder()
        .setTitle("⚠️ Cảnh cáo")
        .addFields(
          { name: "Thành viên", value: `${target.tag}`,   inline: true },
          { name: "Lý do",      value: reason,             inline: true },
          { name: "Tổng warn",  value: `${count}`,         inline: true }
        )
        .setColor(count >= 3 ? 0xff0000 : 0xffa500)
        .setDescription(count >= 3 ? "⛔ Đã đủ 3 warn — **Tự động ban**!" : null)
        .setFooter({ text: "Hyggshi OS Bot • Warn" })
        .setTimestamp();

      return send({ embeds: [warnEmbed] });
    }

    if (commandName === "warnlist") {
      const target = interaction.options.getUser("target");

      const { rows } = await pool.query(
        `SELECT * FROM warns WHERE userId=$1 AND guildId=$2 ORDER BY timestamp DESC`,
        [target.id, interaction.guild.id]
      );

      if (!rows.length) return send(`✅ **${target.tag}** chưa có warn nào.`);

      let desc = "";
      for (const row of rows) {
        desc += `• ${row.reason} — <t:${Math.floor(row.timestamp/1000)}:f>\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Danh sách warn — ${target.tag}`)
        .setDescription(desc)
        .setColor(0xffa500)
        .setFooter({ text: `Tổng: ${rows.length} warn • Hyggshi OS Bot` })
        .setTimestamp();

      return send({ embeds: [embed] });
    }

    if (commandName === "clearwarn") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
        return sendEphemeral("🚫 Chỉ **Admin** mới có thể xoá warn!");

      const target = interaction.options.getUser("target");

      await pool.query(
        `DELETE FROM warns WHERE userId=$1 AND guildId=$2`,
        [target.id, interaction.guild.id]
      );

      return send(`✅ Đã xoá toàn bộ warn của **${target.tag}**.`);
    }

  } catch (err) {
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

  const check = safetyCheck(msg.content);
  if (check.blocked) {
    console.log(`🛡️ [Safety] Tin nhắn bị chặn từ ${msg.author.tag}: "${msg.content}"`);
    await sendSafetyWarning(msg, check.matched, "message");
    try { await msg.delete(); } catch (_) {}

    if (msg.guild) await recordViolation(msg.guild.id, msg.channel);
    return;
  }

  const wasHandled = await handleCalmModeMessage(msg);
  if (wasHandled) return;

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

client.on("guildMemberAdd", async member => {
  // ── Anti Raid ──
  const now = Date.now();
  joinTracker.push({ id: member.id, time: now });
  joinTracker = joinTracker.filter(j => now - j.time < 10000);

  if (joinTracker.length >= 5) {
    console.log("⚠️ RAID DETECTED");
    for (const join of joinTracker) {
      const m = await member.guild.members.fetch(join.id).catch(() => null);
      if (m?.bannable)
        await m.ban({ reason: "Anti-Raid Protection" });
    }
    joinTracker = [];
    return; // Không gửi welcome khi đang raid
  }

  // ── Welcome ──
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
const IGNORABLE_DISCORD_CODES = [
  10062, // Unknown interaction
  10008, // Unknown message
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
    console.warn(`⚠️ [Discord] Bỏ qua uncaughtException nhẹ: [${err.code}] ${err.message}`);
    return;
  }
  console.error("❌ Uncaught Exception nghiêm trọng:", err);
  process.exit(1);
});

// ================== LOGIN ==================
client.login(TOKEN).catch(err => {
  console.error("❌ Login thất bại:", err.message);
  process.exit(1);
});
