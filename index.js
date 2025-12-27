// ==== CLOUDFLARE WORKERS DISCORD BOT ====
// Phiên bản: 2.0.0 for Cloudflare
// Dev: Nguyễn Minh Phúc

// ==== CONFIG ====
const BOT_START_TIME = Date.now();

// ==== VERIFY DISCORD SIGNATURE (Ed25519) ====
async function verifyDiscordRequest(request, publicKey) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.clone().text();

  if (!signature || !timestamp || !publicKey) {
    return { isValid: false, body: null };
  }

  try {
    const isValid = await verifyEd25519(
      signature,
      timestamp + body,
      publicKey
    );
    
    return { 
      isValid, 
      body: isValid ? JSON.parse(body) : null 
    };
  } catch (err) {
    console.error('Verification error:', err);
    return { isValid: false, body: null };
  }
}

// Ed25519 verification using Web Crypto API
async function verifyEd25519(signature, message, publicKey) {
  const encoder = new TextEncoder();
  
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(publicKey),
    {
      name: 'Ed25519',
      namedCurve: 'Ed25519'
    },
    false,
    ['verify']
  );

  return await crypto.subtle.verify(
    'Ed25519',
    key,
    hexToBytes(signature),
    encoder.encode(message)
  );
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// ==== COMMANDS DATA ====
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
  const { data, member, guild_id } = interaction;
  const commandName = data.name;
  
  const uptime = Date.now() - BOT_START_TIME;
  const hours = Math.floor(uptime / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  const seconds = Math.floor((uptime % 60000) / 1000);

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
      const user = member?.user || interaction.user;
      return {
        embeds: [{
          title: '🧑‍💻 Thông tin của bạn',
          fields: [
            { name: 'Username', value: user.username, inline: true },
            { name: 'ID', value: user.id, inline: true },
            { name: 'Avatar', value: `[Xem avatar](https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png)`, inline: false }
          ],
          thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
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
            { name: 'Phiên bản', value: '2.0.0 (Cloudflare)', inline: true },
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
      const targetUser = target ? interaction.data.resolved.users[target.value] : (member?.user || interaction.user);
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
      const huggerUser = member?.user || interaction.user;
      return { content: `🤗 <@${huggerUser.id}> đã ôm <@${hugUser.id}>! 💕` };

    default:
      return { content: '❌ Lệnh không tồn tại!' };
  }
}

// ==== JSON RESPONSE HELPER ====
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
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

    // Health check endpoints
    if (url.pathname === '/') {
      return new Response('🤖 Hyggshi OS Bot is alive on Cloudflare Workers!', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    if (url.pathname === '/ping') {
      return jsonResponse({ 
        status: 'ok', 
        timestamp: Date.now(),
        platform: 'Cloudflare Workers'
      });
    }

    if (url.pathname === '/commands') {
      return jsonResponse(COMMANDS);
    }

    // Discord interactions endpoint
    if (url.pathname === '/interactions' && request.method === 'POST') {
      const publicKey = env.DISCORD_PUBLIC_KEY;
      
      if (!publicKey) {
        return jsonResponse({ error: 'DISCORD_PUBLIC_KEY not configured' }, 500);
      }

      const { isValid, body } = await verifyDiscordRequest(request, publicKey);
      
      if (!isValid) {
        return jsonResponse({ error: 'Invalid request signature' }, 401);
      }

      // Handle Discord PING
      if (body.type === 1) {
        return jsonResponse({ type: 1 });
      }

      // Handle slash commands
      if (body.type === 2) {
        try {
          const responseData = handleCommand(body);
          return jsonResponse({
            type: 4,
            data: responseData
          });
        } catch (error) {
          console.error('Command error:', error);
          return jsonResponse({
            type: 4,
            data: { content: '❌ Đã xảy ra lỗi khi xử lý lệnh!' }
          });
        }
      }

      return jsonResponse({ error: 'Unknown interaction type' }, 400);
    }

    return new Response('404 Not Found', { status: 404 });
  }
};
