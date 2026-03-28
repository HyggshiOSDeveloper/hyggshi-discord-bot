/**
 * logger.js
 * Handles mod-log logging.
 */

const { EmbedBuilder } = require("discord.js");
const { getConfig } = require("./config");

/**
 * Logs a moderation action to the mod-log channel.
 * @param {import('discord.js').Message} message The original message.
 * @param {string} reason The reason for moderation.
 * @param {string} detected The content that triggered the filter.
 */
async function logToModLog(message, reason, detected) {
  if (!message.guild) return;

  const config = getConfig();
  const channelNameOrId = config.modLogChannel || "mod-logs";
  
  const logChannel = message.guild.channels.cache.find(
    ch => ch.name === channelNameOrId || ch.id === channelNameOrId
  );

  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("Moderation Action")
    .setColor(0xFF0000)
    .addFields(
      { name: "User", value: `${message.author.tag} (${message.author.id})`, inline: true },
      { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
      { name: "Reason", value: reason, inline: true },
      { name: "Detected Content", value: `\`${detected}\``, inline: true },
      { name: "Original Message", value: message.content.substring(0, 1024) || "(empty)" }
    )
    .setTimestamp();

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Failed to send log to mod-log channel:", error.message);
  }
}

module.exports = { logToModLog };
