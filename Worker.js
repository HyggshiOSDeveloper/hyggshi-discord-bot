/**
 * Discord Bot for Cloudflare Workers
 * Fixed implementation with proper request verification and routing
 */

import { verifyKey } from 'discord-interactions';

// Discord Interaction Types
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
};

// Discord Interaction Response Types
const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
};

class JsonResponse extends Response {
  constructor(body, init) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

/**
 * Main worker fetch handler
 */
export default {
  async fetch(request, env, ctx) {
    // Only handle POST requests
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // Verify the request signature
      const signature = request.headers.get('x-signature-ed25519');
      const timestamp = request.headers.get('x-signature-timestamp');
      const body = await request.clone().arrayBuffer();

      const isValidRequest = await verifyKey(
        body,
        signature,
        timestamp,
        env.DISCORD_PUBLIC_KEY
      );

      if (!isValidRequest) {
        console.error('Invalid request signature');
        return new Response('Bad request signature', { status: 401 });
      }

      // Parse the interaction
      const interaction = await request.json();

      // Handle PING from Discord
      if (interaction.type === InteractionType.PING) {
        return new JsonResponse({
          type: InteractionResponseType.PONG,
        });
      }

      // Handle slash commands
      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        return handleCommand(interaction, env);
      }

      // Handle message components (buttons, select menus, etc.)
      if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        return handleComponent(interaction, env);
      }

      return new Response('Unknown interaction type', { status: 400 });
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },
};

/**
 * Handle slash commands
 */
async function handleCommand(interaction, env) {
  const { name } = interaction.data;

  switch (name) {
    case 'hello':
      return handleHelloCommand(interaction);
    case 'ping':
      return handlePingCommand(interaction);
    case 'info':
      return handleInfoCommand(interaction);
    default:
      return new JsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Unknown command',
        },
      });
  }
}

/**
 * Handle message components (buttons, select menus)
 */
async function handleComponent(interaction, env) {
  const customId = interaction.data.custom_id;

  // Handle different component interactions
  return new JsonResponse({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content: `You clicked: ${customId}`,
    },
  });
}

/**
 * Hello command handler
 */
function handleHelloCommand(interaction) {
  const userId = interaction.member?.user?.id || interaction.user?.id;
  
  return new JsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `Hello, <@${userId}>! 👋`,
      allowed_mentions: {
        users: [userId],
      },
    },
  });
}

/**
 * Ping command handler
 */
function handlePingCommand(interaction) {
  return new JsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '🏓 Pong!',
    },
  });
}

/**
 * Info command handler
 */
function handleInfoCommand(interaction) {
  return new JsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: 'Bot Information',
          description: 'This bot is running on Cloudflare Workers!',
          color: 0x5865f2,
          fields: [
            {
              name: 'Framework',
              value: 'Cloudflare Workers',
              inline: true,
            },
            {
              name: 'Language',
              value: 'JavaScript',
              inline: true,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    },
  });
}
