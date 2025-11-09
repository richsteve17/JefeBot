// Test script to connect to SUGO WebSocket and log all messages
// Run with: npx tsx test-ws-connection.ts

import WebSocket from 'ws';
import zlib from 'zlib';

const WS_URL = 'wss://activity-ws-rpc.voicemaker.media/ws/activity';
const TOKEN = 'LLAWRORtEXmBfK7Hyj3pd1MOfh3hyu67';
const UID = '47585713';

// Headers from your Proxyman capture
const headers = {
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Host': 'activity-ws-rpc.voicemaker.media',
  'Origin': 'https://www.sugo.com',
  'Pragma': 'no-cache',
  'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};

console.log('🔌 Connecting to SUGO WebSocket...');
console.log(`URL: ${WS_URL}`);
console.log(`Token: ${TOKEN}`);
console.log(`UID: ${UID}\n`);

const ws = new WebSocket(WS_URL, {
  headers,
  perMessageDeflate: true
});

ws.on('open', () => {
  console.log('✅ WebSocket CONNECTED!\n');

  // Try common auth/join patterns
  console.log('📤 Attempting to authenticate...\n');

  // Pattern 1: Simple auth object
  const authAttempt1 = JSON.stringify({
    type: 'auth',
    token: TOKEN,
    uid: UID
  });

  // Pattern 2: RPC-style auth
  const authAttempt2 = JSON.stringify({
    id: Date.now(),
    method: 'authenticate',
    params: {
      token: TOKEN,
      uid: UID
    }
  });

  // Pattern 3: Token in header style
  const authAttempt3 = JSON.stringify({
    action: 'authenticate',
    data: {
      authorization: `Bearer ${TOKEN}`,
      user_id: UID
    }
  });

  // Try the first pattern
  console.log('Trying auth pattern 1:', authAttempt1);
  ws.send(authAttempt1);

  // After 2 seconds, try pattern 2
  setTimeout(() => {
    console.log('\nTrying auth pattern 2:', authAttempt2);
    ws.send(authAttempt2);
  }, 2000);

  // After 4 seconds, try pattern 3
  setTimeout(() => {
    console.log('\nTrying auth pattern 3:', authAttempt3);
    ws.send(authAttempt3);
  }, 4000);
});

ws.on('message', (data: WebSocket.RawData) => {
  console.log('\n📨 RECEIVED MESSAGE:');
  console.log('─────────────────────────────────');

  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);

  // Try to decode if compressed
  let decoded: string | null = null;

  try {
    decoded = zlib.gunzipSync(buf).toString('utf8');
    console.log('📦 [GZIP decoded]');
  } catch {
    try {
      decoded = zlib.inflateSync(buf).toString('utf8');
      console.log('📦 [ZLIB decoded]');
    } catch {
      decoded = buf.toString('utf8');
      console.log('📝 [Plain text]');
    }
  }

  // Try to parse as JSON
  try {
    const json = JSON.parse(decoded);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log(decoded);
  }

  console.log('─────────────────────────────────\n');
});

ws.on('error', (err) => {
  console.error('❌ WebSocket ERROR:', err.message);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 WebSocket CLOSED`);
  console.log(`Code: ${code}`);
  console.log(`Reason: ${reason.toString() || '(none)'}`);
});

// Send a ping every 25 seconds to keep alive
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('💓 Sending heartbeat ping...');
    ws.ping();
  }
}, 25000);

// Keep the script running
console.log('Press Ctrl+C to exit\n');
