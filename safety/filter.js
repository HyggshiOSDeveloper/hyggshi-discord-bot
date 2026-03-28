/**
 * filter.js
 * Handles word filtering logic.
 */

const { getConfig } = require("./config");

/**
 * Checks if the content contains banned words or invite links.
 * @param {string} content The message content to check.
 * @returns {string|null} The detected word or link, or null if clean.
 */
function checkFilter(content) {
  if (!content) return null;
  
  const config = getConfig();
  const lowerContent = content.toLowerCase();

  // 1. Check for Discord invite links
  const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)([a-z0-9-]+)/gi;
  if (inviteRegex.test(lowerContent)) {
    return "discord.gg invite link";
  }

  // 2. Collect all banned words from config categories
  let allBannedWords = [...(config.bannedWords || [])];
  
  if (config.rules) {
    for (const category of Object.values(config.rules)) {
      if (category.words && Array.isArray(category.words)) {
        allBannedWords.push(...category.words);
      }
    }
  }

  // Remove duplicates and empty strings
  allBannedWords = [...new Set(allBannedWords)].filter(w => w.length > 0);

  // 3. Detect words inside sentences (case-insensitive substring match)
  for (const word of allBannedWords) {
    if (lowerContent.includes(word.toLowerCase())) {
      return word;
    }
  }

  return null;
}

module.exports = { checkFilter };
