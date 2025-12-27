/**
 * Hyggshi OS Discord Bot - Cloudflare Workers
 * Version: 2.0.1
 * Dev: Nguyễn Minh Phúc
 */

const BOT_START_TIME = Date.now();

// ==== HELPER FUNCTIONS ====
function hexToUint8Array(hex) {
  const matches = hex.match(/.{1,2}/g);
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

async function verifyDiscordSignature(request, publicKey) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  
  if (!signature || !timestamp || !publicKey) {
    return { isValid: false, body: null };
  }

  const body = await request.text();
  const message = timestamp + body;

  try {
    // Import public key
    const keyData = hexToUint8Array(publicKey);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'Ed25519',
        namedCurve: 'Ed25519',
      },
      false,
      ['verify']
    );

    // Verify signature
    const signatureData = hexToUint8Array(signature);
    const messageData = new TextEncoder().encode(message);
    
    const isValid = await crypto.subtle.verify(
      'Ed25519',
      cryptoKey,
      signatureData,
      messageData
    );

    return {
      isValid,
      body: isValid ? JSON.parse(body) : null
    };
  } catch (error) {
    console.error('Verification error:', error);
    return { isValid: false, body: null };
  }
}

// ==== COMMANDS ====
const COMMANDS = [
  { name: 'ping', description: 'Kiểm tra độ trễ phản hồi của bot' },
  { name: 'status', description: 'Hiển thị trạng thái bot' },
  { name: 'info', description: 'Giới thiệu bot' },
  { name: 'help', description: 'Danh sách lệnh có sẵn' },
  { name: 'server', description: 'Thông tin máy chủ' },
  { name: 'user', description: 'Xem thông tin tài khoản Discord' },
  { name: 'members', description: 'Số thành viên trong server' },
  { name: 'botinfo', description: 'Thông tin bot' },
  { name: 'github', description: 'Link GitHub dự án' },
  { 
    name: 'say', 
    description: 'Bot lặp lại câu bạn nhập',
    options: [{
      type: 3,
      name: 'message',
      description: 'Câu bạn muốn bot lặp lại',
      required: true
    }]
  },
  { name: 'roll', description: 'Tung xúc xắc 1-100' },
  { name: 'flip', description: 'Tung đồng xu (Heads/Tails)' },
  { 
    name: 'avatar', 
    description: 'Xem avatar của bạn hoặc người khác',
    options: [{
      type: 6,
      name: 'target',
      description: 'Người bạn muốn xem avatar',
      required: false
    }]
  },
  { 
    name: 'hug', 
    description: 'Ôm một người nào đó',
    options: [{
      type: 6,
      name: 'target',
      description: 'Người muốn ôm',
      required: false
    }]
  },
  { name: 'uptime', description: 'Xem thời gian bot chạy' }
];

// ==== COMMAND HANDLERS ====
function handleCommand(interaction) {
  const { data, member, guild_id, user } = interaction;
  const commandName = data.name;
  
  const uptime = Date.now() - BOT_START_TIME;
  const hours = Math.floor(uptime / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  const seconds = Math.floor((uptime % 60000) / 1000);

  const currentUser = member?.user || user;

  switch (commandName) {
    case 'ping':
      return { content: `🏓 Pong! Bot đang hoạt động tốt.` };

    case 'status':
      return { 
        content: `**Bot:** Hyggshi OS Bot\n**Trạng thái:** Online ✅\n**Uptime:** ${hours}h ${minutes}m ${seconds}s` 
      };

    case 'info':
      return { 
        content: `🤖 **Hyggshi OS Bot** là trợ lý Discord hỗ trợ quản lý server và phản hồi tự động.\n❤️ Dev: Nguyễn Minh Phúc\n⚡ Powered by Cloudflare Workers` 
      };

    case 'help':
      return {
        embeds: [{
          title: '📋 Danh sách lệnh',
          description: COMMANDS.map(cmd => `🔹 \`/${cmd.name}\` - ${cmd.description}`).join('\n'),
          color: 0x00aaff,
          footer: { text: 'Hyggshi OS Bot v2.0' }
        }]
      };

    case 'server':
      return {
        embeds: [{
          title: '🏠 Thông tin Server',
          fields: [
            { name: 'Server ID', value: guild_id || 'N/A', inline: true },
            { name: 'Vị trí', value: 'Cloudflare Edge', inline: true }
          ],
          color: 0x00ff00,
          timestamp: new Date().toISOString()
        }]
      };

    case 'user':
      return {
        embeds: [{
          title: '🧑‍💻 Thông tin của bạn',
          fields: [
            { name: 'Username', value: currentUser.username, inline: true },
            { name: 'ID', value: currentUser.id, inline: true },
            { name: 'Avatar', value: `[Xem avatar](https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png)`, inline: false }
          ],
          thumbnail: { url: `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png` },
          color: 0x5865f2
        }]
      };

    case 'members':
      return { content: '👥 Thông tin thành viên đang được cập nhật...' };

    case 'botinfo':
      return {
        embeds: [{
          title: '🤖 Hyggshi OS Bot',
          fields: [
            { name: 'Phiên bản', value: '2.0.1 (Cloudflare)', inline: true },
            { name: 'Dev', value: 'Nguyễn Minh Phúc', inline: true },
            { name: 'Uptime', value: `${hours}h ${minutes}m ${seconds}s`, inline: false },
            { name: 'Platform', value: '⚡ Cloudflare Workers', inline: true }
          ],
          color: 0xf38020
        }]
      };

    case 'github':
      return { 
        content: '🔗 **GitHub:** https://github.com/HyggshiOSDeveloper/Hyggshi-OS-project-center' 
      };

    case 'say':
      const message = data.options?.find(opt => opt.name === 'message')?.value;
      return { content: message || '(Không có tin nhắn)' };

    case 'roll':
      const result = Math.floor(Math.random() * 100) + 1;
      return { content: `🎲 Bạn tung được: **${result}**` };

    case 'flip':
      const coin = Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙';
      return { content: `💰 Coin flip: **${coin}**` };

    case 'uptime':
      return { content: `🕒 Bot đã chạy được: **${hours}** giờ **${minutes}** phút **${seconds}** giây` };

    case 'avatar':
      const target = data.options?.find(opt => opt.name === 'target');
      const targetUser = target ? interaction.data.resolved.users[target.value] : currentUser;
      return {
        embeds: [{
          title: `🖼️ Avatar của ${targetUser.username}`,
          image: { url: `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.png?size=1024` },
          color: 0x00aaff
        }]
      };

    case 'hug':
      const hugTarget = data.options?.find(opt => opt.name === 'target');
      if (!hugTarget) {
        return { content: '🤗 Bạn đã tự ôm mình rồi đó... dễ thương quá!' };
      }
      const hugUser = interaction.data.resolved.users[hugTarget.value];
      return { content: `🤗 <@${currentUser.id}> đã ôm <@${hugUser.id}>! 💕` };

    default:
      return { content: '❌ Lệnh không tồn tại!' };
  }
}

// ==== MAIN WORKER ====
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/ping') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: Date.now(),
        platform: 'Cloudflare Workers',
        version: '2.0.1'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Commands list
    if (url.pathname === '/commands') {
      return new Response(JSON.stringify(COMMANDS, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Discord interactions
    if (url.pathname === '/interactions' && request.method === 'POST') {
      const publicKey = env.DISCORD_PUBLIC_KEY;
      
      if (!publicKey) {
        console.error('DISCORD_PUBLIC_KEY not set');
        return new Response(JSON.stringify({ 
          error: 'DISCORD_PUBLIC_KEY not configured' 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { isValid, body } = await verifyDiscordSignature(request, publicKey);
      
      if (!isValid) {
        console.error('Invalid signature');
        return new Response(JSON.stringify({ 
          error: 'Invalid request signature' 
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Handle Discord PING (type 1)
      if (body.type === 1) {
        return new Response(JSON.stringify({ type: 1 }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Handle slash commands (type 2)
      if (body.type === 2) {
        try {
          const responseData = handleCommand(body);
          return new Response(JSON.stringify({
            type: 4,
            data: responseData
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Command error:', error);
          return new Response(JSON.stringify({
            type: 4,
            data: { content: '❌ Đã xảy ra lỗi khi xử lý lệnh!' }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({ 
        error: 'Unknown interaction type' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('404 Not Found', { status: 404 });
  }
};
