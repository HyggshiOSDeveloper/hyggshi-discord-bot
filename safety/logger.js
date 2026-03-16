const { EmbedBuilder } = require("discord.js");

function truncate(text, max = 900) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

async function logViolation({ client, message, violation, config }) {
  if (!message.guild) return;

  const channelName = config.modLogChannel || "mod-logs";
  const channel = message.guild.channels.cache.find(ch => ch.name === channelName || ch.id === channelName);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("Safety Filter — Log")
    .setColor(0xff4444)
    .addFields(
      { name: "User", value: `${message.author}`, inline: true },
      { name: "User ID", value: message.author.id, inline: true },
      { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
      { name: "Severity", value: violation.severity || "LOW", inline: true },
      { name: "Detected Keyword", value: violation.detectedWord ? String(violation.detectedWord) : "n/a", inline: true },
      { name: "Reason", value: violation.reason || "Policy violation", inline: true },
      { name: "Message Content", value: truncate(message.content || "(empty)") }
    )
    .setTimestamp(new Date());

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { logViolation };
