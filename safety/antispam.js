/**
 * antispam.js
 * Handles spam detection and automated timeouts.
 */

// Map to store user message timestamps: userId -> timestamp[]
const userMessages = new Map();

/**
 * Checks if a user is spamming and applies a timeout if necessary.
 * @param {import('discord.js').Message} message The message to check.
 * @returns {Promise<boolean>} True if spam was detected and handled, false otherwise.
 */
async function checkSpam(message) {
  if (!message.guild || !message.member || message.author.bot) return false;

  const userId = message.author.id;
  const now = Date.now();
  const windowMs = 10000; // 10 seconds
  const limit = 5; // More than 5 messages

  if (!userMessages.has(userId)) {
    userMessages.set(userId, []);
  }

  const timestamps = userMessages.get(userId);
  
  // Clean up old timestamps
  const recentTimestamps = timestamps.filter(time => now - time < windowMs);
  recentTimestamps.push(now);
  userMessages.set(userId, recentTimestamps);

  if (recentTimestamps.length > limit) {
    // Spam detected
    try {
      // Timeout for 10 minutes (600,000 ms)
      await message.member.timeout(10 * 60 * 1000, "Anti-spam: Sending messages too fast");
      
      await message.channel.send({
        content: `⚠️ ${message.author}, you have been timed out for 10 minutes due to spamming.`
      }).catch(() => {});
      
      return true;
    } catch (error) {
      console.error(`Failed to timeout user ${userId}:`, error.message);
      // Even if timeout fails (e.g., missing permissions), we still return true to block further processing
      return true;
    }
  }

  return false;
}

module.exports = { checkSpam };
