// Final SUGO WebSocket Test with proper auth
// Run with: npx tsx test-sugo-final.ts

import { SugoClient } from './server/sugoClient.js';

const TOKEN = 'LLAWRORtEXmBfK7Hyj3pd1MOfh3hyu67';
const UID = '47585713';
const ROOM_ID = '1250911';
const WS_URL = 'wss://activity-ws-rpc.voicemaker.media/ws/activity';

const headers = {
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Host': 'activity-ws-rpc.voicemaker.media',
  'Origin': 'https://www.sugo.com',
  'Pragma': 'no-cache',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};

console.log('🚀 Rich$teve Bot - SUGO WebSocket Test\n');
console.log('Configuration:');
console.log(`  URL: ${WS_URL}`);
console.log(`  Token: ${TOKEN.substring(0, 10)}...`);
console.log(`  UID: ${UID}`);
console.log(`  Room: ${ROOM_ID}\n`);

const makeJoinFrame = (roomId: string) => JSON.stringify({
  type: 'join_room',
  room_id: roomId,
  timestamp: Date.now()
});

const makeSendFrame = (roomId: string, text: string) => JSON.stringify({
  type: 'chat_message',
  room_id: roomId,
  message: text,
  timestamp: Date.now()
});

const client = new SugoClient({
  url: WS_URL,
  headers,
  roomId: ROOM_ID,
  token: TOKEN,
  uid: UID,
  heartbeatMs: 25000,
  decompress: 'auto',
  makeJoinFrame,
  makeSendFrame
});

client.on('log', (msg) => {
  console.log(`📝 ${msg}`);
});

client.on('open', () => {
  console.log('✅ CONNECTED to SUGO!\n');
  console.log('Waiting for messages from SUGO...\n');
  console.log('If you see messages below, we\'re in! 🎉\n');
  console.log('─────────────────────────────────────\n');
});

client.on('message', (msg) => {
  console.log('📨 INCOMING MESSAGE:');
  console.log('─────────────────────────────────────');
  try {
    console.log(JSON.stringify(msg, null, 2));
  } catch {
    console.log(msg);
  }
  console.log('─────────────────────────────────────\n');
});

client.on('error', (err) => {
  console.error('❌ ERROR:', err.message);
});

client.on('close', (code, reason) => {
  console.log(`\n🔌 Connection CLOSED`);
  console.log(`Code: ${code}`);
  console.log(`Reason: ${reason || '(none)'}\n`);

  if (code === 1006) {
    console.log('💡 TIP: This error usually means:');
    console.log('  1. Can\'t reach the server (DNS/network issue)');
    console.log('  2. Auth failed (wrong token/UID)');
    console.log('  3. Server rejected the connection');
    console.log('\nThis is expected if running from a server that can\'t reach SUGO.');
    console.log('Try running this from your local machine or deployment environment.\n');
  }
});

console.log('Attempting connection...\n');
client.connect();

// Try sending a test message after 5 seconds
setTimeout(() => {
  if (client.isOpen()) {
    console.log('📤 Sending test message: "🎧 Vibe check! Drop 1-5 in chat!"');
    client.sendChat('🎧 Vibe check! Drop 1-5 in chat!');
  }
}, 5000);

// Keep alive for 30 seconds
setTimeout(() => {
  console.log('\n⏰ Test complete. Disconnecting...');
  client.disconnect();
  process.exit(0);
}, 30000);

console.log('Test will run for 30 seconds. Press Ctrl+C to exit early.\n');
