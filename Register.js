/**
 * Register commands with Discord
 * Run this script to register slash commands with Discord API
 */

import 'dotenv/config';

// Command definitions
const commands = [
  {
    name: 'hello',
    description: 'Get a friendly greeting from the bot',
  },
  {
    name: 'ping',
    description: 'Check if the bot is responsive',
  },
  {
    name: 'info',
    description: 'Get information about the bot',
  },
];

/**
 * Register commands globally
 */
async function registerGlobalCommands() {
  const url = `https://discord.com/api/v10/applications/${process.env.DISCORD_APPLICATION_ID}/commands`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    },
    body: JSON.stringify(commands),
  });

  if (response.ok) {
    console.log('✅ Successfully registered global commands');
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.error('❌ Error registering commands');
    const text = await response.text();
    console.error(text);
  }
}

/**
 * Register commands to a specific guild (for testing)
 */
async function registerGuildCommands(guildId) {
  const url = `https://discord.com/api/v10/applications/${process.env.DISCORD_APPLICATION_ID}/guilds/${guildId}/commands`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    },
    body: JSON.stringify(commands),
  });

  if (response.ok) {
    console.log(`✅ Successfully registered commands for guild ${guildId}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.error('❌ Error registering guild commands');
    const text = await response.text();
    console.error(text);
  }
}

// Main execution
const guildId = process.env.DISCORD_GUILD_ID;

if (guildId) {
  console.log(`Registering commands for guild: ${guildId}`);
  registerGuildCommands(guildId);
} else {
  console.log('Registering commands globally (this may take up to 1 hour to propagate)');
  registerGlobalCommands();
}
