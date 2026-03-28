// Example implementation for messageCreate event in index.js (or any event handler)

const { checkFilter } = require('./safety/filter');
const { checkSpam } = require('./safety/antispam');
const { logToModLog } = require('./safety/logger');

client.on("messageCreate", async (message) => {
  // Ignore bots and DM messages
  if (message.author.bot || !message.guild) return;

  // 1. Anti-Spam Check
  const isSpamming = await checkSpam(message);
  if (isSpamming) {
    try {
      if (message.deletable) await message.delete();
    } catch (e) {}
    return; // Stop processing if user is spamming
  }

  // 2. Word Filter Check
  const detectedWord = checkFilter(message.content);
  if (detectedWord) {
    try {
      // Delete the inappropriate message
      if (message.deletable) {
        await message.delete();
      }

      // Send a warning message tagging the user
      await message.channel.send({
        content: `⚠️ ${message.author}, your message was removed because it contained inappropriate content (\`${detectedWord}\`).`
      });

      // Log the violation to the mod-log channel
      await logToModLog(message, "Banned word/link detected", detectedWord);
      
    } catch (error) {
      console.error("Error handling filtered message:", error.message);
    }
    return; // Stop processing further
  }

  // ... rest of your messageCreate logic (e.g., commands)
});
