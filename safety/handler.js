const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const { getConfig } = require("./config");
const { analyzeText } = require("./filterEngine");
const { logViolation } = require("./logger");

function isIgnoredChannel(config, channel) {
  if (!channel) return false;
  if ((config.ignoreChannelIds || []).includes(channel.id)) return true;
  const lower = channel.name?.toLowerCase();
  if (lower && (config.ignoreChannelNames || []).map(n => n.toLowerCase()).includes(lower)) return true;
  return false;
}

function hasBypass(config, member) {
  if (!member) return false;
  if (config.adminBypass && member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (config.bypassRoleIds && config.bypassRoleIds.length) {
    return config.bypassRoleIds.some(id => member.roles.cache.has(id));
  }
  return false;
}

function buildWarningEmbed(violation, config) {
  return new EmbedBuilder()
    .setTitle("Safety Filter — Content Blocked")
    .setDescription("Your message violated community guidelines and has been removed.")
    .addFields(
      { name: "Reason", value: violation.reason || "Policy violation" },
      { name: "Detected word", value: violation.detectedWord ? `||${violation.detectedWord}||` : "n/a" },
      { name: "Warning message", value: config.warningMessage || "Please keep the conversation respectful." }
    )
    .setColor(0xff3333)
    .setTimestamp();
}

async function applyActions(message, violation, config) {
  const severity = (violation.severity || "LOW").toUpperCase();
  const actions = config.severityActions[severity] || config.severityActions.LOW;

  if (actions.delete) {
    try { await message.delete(); } catch (_) {}
  }

  if (actions.timeout) {
    const duration = config.timeoutMs || 10 * 60 * 1000;
    try { await message.member.timeout(duration, "Safety Filter violation"); } catch (_) {}
  }

  if (actions.warn) {
    const embed = buildWarningEmbed(violation, config);
    await message.channel.send({ content: `${message.author}`, embeds: [embed] }).catch(() => {});
  }
}

async function handleMessage(message) {
  if (message.author.bot) return false;
  if (!message.guild) return false;

  const config = getConfig();
  if (!config.enabled) return false;

  if (isIgnoredChannel(config, message.channel)) return false;
  if (hasBypass(config, message.member)) return false;

  const violation = analyzeText(message.content || "", message.author.id, config);
  if (!violation.blocked) return false;

  await applyActions(message, violation, config);
  await logViolation({ message, violation, config });
  return true;
}

async function handleCommandText(interaction, text) {
  const config = getConfig();
  if (!config.enabled) return { blocked: false };
  if (hasBypass(config, interaction.member)) return { blocked: false };

  const violation = analyzeText(text || "", interaction.user.id, config);
  if (!violation.blocked) return { blocked: false };

  const embed = buildWarningEmbed(violation, config);
  await interaction.editReply({ embeds: [embed] }).catch(() => {});
  return { blocked: true, violation };
}

module.exports = {
  handleMessage,
  handleCommandText
};

