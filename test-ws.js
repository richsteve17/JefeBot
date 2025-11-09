// Minimal WebSocket test - run locally to isolate the issue
import WebSocket from 'ws';

const token = 'hh0IzrHHngg79OZQQwk8BcZZXJhoeGK4';

console.log('🔌 Connecting to SUGO WebSocket...');
console.log(`   Token: ${token.slice(0, 8)}...`);
console.log(`   Protocol: Single token only`);
console.log('');

const ws = new WebSocket(
  'wss://activity-ws-rpc.voicemaker.media/ws/activity',
  [token],
  {
    headers: {
      'Accept': '*/*',
      'Origin': 'https://activity-h5.voicemaker.media',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) SUGO/392401 version/vc-392401-vn-2.40.1 statusHeight/54.0 LangCode/en',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Site': 'same-site',
      'Sec-Fetch-Mode': 'websocket',
      'Sec-Fetch-Dest': 'websocket',
      'Cookie': 'appsflyer-id=1734994530097-1901624; brand=iPhone; channel=AppStore; did=654fab11f3b88db3fbfdd2c400e63142a3b4f455; idfa=3984AFF3-7633-4298-91C0-7A89AFDE80F6; language=en; locale=en_US; mcc=65535; os=ios-26.1-iPhone 16 Pro Max; pkg=com.maker.sugo; show-id=47585713; timezone=-5; token=hh0IzrHHngg79OZQQwk8BcZZXJhoeGK4; uid=47585713; version=vc-392401-vn-2.40.1'
    },
    perMessageDeflate: false
  }
);

ws.on('open', () => {
  const negotiated = ws.protocol || 'none';
  console.log('✅ CONNECTED!');
  console.log(`   Negotiated protocol: ${negotiated}`);
  console.log('');

  // Send JOIN immediately
  const joinFrame = JSON.stringify({
    cmd: 100,
    data: {
      uid: '47585713',
      did: '654fab11f3b88db3fbfdd2c400e63142a3b4f455',
      version: 'vc-392401-vn-2.40.1',
      activity_id: 10231,
      token: token
    }
  });

  console.log('📤 Sending JOIN frame...');
  console.log(`   ${joinFrame.slice(0, 100)}...`);
  ws.send(joinFrame);
});

ws.on('message', (data) => {
  const text = data.toString();
  console.log('📥 RECEIVED:', text.slice(0, 200));

  try {
    const msg = JSON.parse(text);
    if (msg.cmd === 338) {
      console.log('   ✅ Got cmd 338 HELLO!');
    }
  } catch {}
});

ws.on('error', (err) => {
  console.error('❌ ERROR:', err.message);
});

ws.on('close', (code, reason) => {
  console.log(`❌ CLOSED: ${code} ${reason}`);
  process.exit(code === 1000 ? 0 : 1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏱️  Timeout - no response after 10s');
  ws.close();
}, 10000);
