// ws_probe.js - Quick WebSocket protocol testing
// Usage:
//   node ws_probe.js \
//     WS_URL="wss://activity-ws-rpc.voicemaker.media/ws/activity" \
//     ORIGIN="https://www.sugo.com" \
//     COOKIE="<from-proxyman>" \
//     PROTO="im-auth;v=1;token=eyJ..."

import WebSocket from 'ws';

const url = process.env.WS_URL || 'wss://activity-ws-rpc.voicemaker.media/ws/activity';
const origin = process.env.ORIGIN || 'https://www.sugo.com';
const cookie = process.env.COOKIE || '';
const ua = process.env.UA || 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15';
const proto = process.env.PROTO;

console.log('=== WebSocket Protocol Probe ===');
console.log('URL:', url);
console.log('Origin:', origin);
console.log('Protocol:', proto || '(none)');
console.log('Cookie:', cookie ? `${cookie.slice(0, 40)}...` : '(none)');
console.log('---');

const headers = {
  'Origin': origin,
  'User-Agent': ua,
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

if (cookie) {
  headers['Cookie'] = cookie;
}

const protocols = proto ? proto.split(',').map(s => s.trim()) : undefined;

const ws = new WebSocket(url, protocols, {
  headers,
  perMessageDeflate: false
});

ws.on('open', () => {
  const negotiated = ws.protocol || 'none';
  console.log('✅ OPEN');
  console.log('   Negotiated protocol:', negotiated);

  if (!negotiated || negotiated === 'none' || negotiated === '') {
    console.log('❌ Server rejected subprotocol!');
    console.log('   → Token format is wrong or stale');
    console.log('   → Try different PROTO formats:');
    console.log('      • "im-auth;v=1;token=<token>"');
    console.log('      • "activity-auth,<token>"');
    console.log('      • Just the raw token');
  } else {
    console.log('✅ Server accepted protocol!');
    console.log('   → You can now send JOIN/SUBSCRIBE');
  }
});

ws.on('message', (data) => {
  const msg = data.toString().slice(0, 200);
  console.log('📨 <<', msg);
});

ws.on('close', (code, reason) => {
  console.log('🔴 CLOSE', code, reason.toString());
  process.exit(0);
});

ws.on('error', (err) => {
  console.log('❌ ERROR', err.message);
  process.exit(1);
});

// Send test JOIN after 1s if connected
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    const join = JSON.stringify({
      id: 1,
      method: 'subscribe',
      params: { channel: 'room:1250911' }
    });
    console.log('📤 >> JOIN', join);
    ws.send(join);
  }
}, 1000);

// Auto-close after 5s
setTimeout(() => {
  console.log('⏱️  Timeout - closing');
  ws.close();
}, 5000);
