# 💰 RICH $TEVE BOT

**The Rich Legacy - Your Interactive MC**

Your complete automated co-host for SUGO live streaming. Turn your music stream into a 24/7 interactive game show while you build the legacy.

---

## 🌟 What is Rich $teve Bot?

Rich $teve Bot is your **four-module interactive MC system** that creates constant "dinámica" (dynamics/energy) in your SUGO live stream. It's not just a tool—it's your hype man, game master, announcer, and DJ assistant all in one.

**Powered by neon orange, black, and white - the Rich Legacy colors.**

### The Four Modules

#### 🎧 **El Músico** (The Musician)
- **Spotify Integration**: Automatically announces every song change
- **Vibe Check Polls**: Engages audience with gift-based reactions
- **Status**: Always on when music is playing
- **Example**:
  ```
  [Rich$teve] 🎧 Now Playing: 'Cute Without The E' - Dashboard Confessional
  [Rich$teve] 🔥 VIBE CHECK! 🔥 How we feeling?
  [Rich$teve] Send a 'Corazón' (❤️) if you LOVE this song!
  ```

#### 📢 **El Anunciador** (The PK Announcer)
- **Automatic PK Detection**: Wakes up when battles start
- **Live Score Updates**: Posts updates every 60 seconds
- **Winner Announcements**: Celebrates with MVP recognition
- **Status**: Sleeps until PK starts, then takes over
- **Example**:
  ```
  [Rich$teve] 🔴🔵 ¡ES TIEMPO DE BATALLA! 🔴🔵
  [Rich$teve] Team Red vs Team Blue
  [Rich$teve] ¡VAMOS! Let's GO!
  ```

#### 🎮 **El Maestro del Juego** (The Game Master)
- **Game Carousel**: Rotates through different mini-games
- **Smart Timing**: Pauses during PKs, fills the silence between
- **Three Game Types**:
  - **Gift Burst**: 60-second race for most gifts
  - **Family Goal**: Collaborative 3-minute goal
  - **King of the Hill**: Last gift wins the crown
- **Status**: Runs automatically on timer
- **Example**:
  ```
  [Rich$teve] 🔥 ¡REGALO RÁPIDO! (Gift Burst!) 🔥
  [Rich$teve] 60 seconds! Most 'Rose' gifts wins!
  [Rich$teve] ¡VAMOS!
  ```

#### 🔥 **El Hype Man** (The Hype Man)
- **Instant Recognition**: Shouts out big gifts immediately
- **Tiered Responses**: Different intensity for different values
- **Status**: Always watching, 24/7
- **Example**:
  ```
  [Rich$teve] 💥💥 ¡QUÉ LOCURA! 💥💥
  [Rich$teve] 👑 ROYALTY 👑
  [Rich$teve] ¡Todos saluden a Kelsey por el 'Castle'!
  ```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- SUGO account with bot credentials
- (Optional) Spotify Premium account

### Installation

```bash
# Install dependencies
npm install

# Start the backend server (in one terminal)
npm run server

# Start the dashboard (in another terminal)
npm run dev
```

The dashboard will open at `http://localhost:3000`

---

## 🔑 Getting Your SUGO Credentials

### What You Need

To run Rich $teve Bot, you need two pieces of information from SUGO:

1. **SUGO Room ID** - Your live stream room identifier
2. **Bot Account Token** - Authentication token for your bot account

### How to Get Them

#### Option 1: From SUGO App/Website

1. **Get Your Room ID**:
   - Open your SUGO live stream
   - Look at the URL: `https://sugo.com/live/[YOUR-ROOM-ID]`
   - Copy that room ID
   - Alternative: Check your profile settings under "Live Stream Settings"

2. **Get Your Bot Account Token**:
   - SUGO typically requires you to register a bot account separately
   - Go to SUGO Developer Portal (if available)
   - Create a new bot application
   - Copy the authentication token provided

#### Option 2: Using Browser Developer Tools

If SUGO doesn't have a public API yet, you can extract credentials from your browser:

1. **Open SUGO in Chrome/Firefox**
2. **Open Developer Tools** (F12)
3. **Go to Network tab**
4. **Start your live stream**
5. **Look for API calls** containing:
   - `room_id` or `channel_id`
   - `token` or `authorization` headers

**Note**: This method is for personal use only. Always follow SUGO's Terms of Service.

#### Option 3: Contact SUGO Support

If you're planning to use this bot professionally:
- Email SUGO support requesting bot API access
- Explain your use case (automated chat engagement)
- They may provide official bot credentials

### Entering Credentials in Dashboard

Once you have your credentials:

1. Start the Rich $teve Bot Dashboard
2. Go to the **Configuration** section
3. Enter your **SUGO Room ID**
4. Enter your **Bot Account Token**
5. (Optional) Add your **Spotify Access Token**
6. Click **START BOT**

---

## 🎵 Getting Your Spotify Token

### Quick Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create an App"
4. Give it a name (e.g., "Rich $teve Bot")
5. Copy your **Client ID** and **Client Secret**

### Getting an Access Token

You need a token with the `user-read-currently-playing` scope.

**Quick Method** (for testing):

1. Go to [Spotify Console](https://developer.spotify.com/console/get-users-currently-playing-track/)
2. Click "Get Token"
3. Check `user-read-currently-playing`
4. Copy the token
5. Paste into dashboard

**Production Method** (OAuth flow):

You'll need to implement OAuth 2.0 flow. The token expires after 1 hour and needs refresh.

For now, the quick method works great for testing!

---

## ⚙️ Configuration

### 1. Connect Your Bot
1. Enter your **SUGO Room ID**
2. Enter your **Bot Account Token**
3. (Optional) Enter your **Spotify Access Token**

### 2. Configure Modules

#### El Músico
- Toggle: Enable/Disable
- Settings:
  - ✅ Enable "Vibe Check" Polls

#### El Anunciador
- Toggle: Enable/Disable
- Automatically activates during PKs

#### El Maestro del Juego
- Toggle: Enable/Disable
- Settings:
  - **Game Interval**: 5-60 minutes (default: 20)
  - **Enabled Games**: Choose which games to rotate
    - ✅ Gift Burst
    - ✅ Family Goal
    - ✅ King of the Hill

#### El Hype Man
- Toggle: Enable/Disable
- Settings:
  - **Minimum Diamonds**: 100-10,000 (default: 1,000)

### 3. Start the Bot
Click the big **▶ START BOT** button and watch the legacy grow!

---

## 🎯 How It All Works Together

Here's a 30-minute scenario with all modules active:

| Time | Event | Module Active |
|------|-------|---------------|
| 7:00 PM | Song changes → Announces + Vibe Check | El Músico |
| 7:03 PM | Song changes → Announces | El Músico |
| 7:05 PM | Big gift received → Instant shout-out | El Hype Man |
| 7:10 PM | Auto-launches "Gift Burst" game (3 min) | El Maestro del Juego |
| 7:13 PM | Game ends, announces winner | El Maestro del Juego |
| 7:20 PM | **You** start a PK → Bot takes over | El Anunciador |
| 7:21 PM | Live PK score update | El Anunciador |
| 7:25 PM | PK ends → Announces winner + MVP | El Anunciador |
| 7:26 PM | Song changes → Back to music | El Músico |

**Result**: Non-stop engagement while you build the legacy!

---

## 🧪 Testing

The dashboard includes test controls to simulate events:

- **Test Vibe Check**: Manually trigger a vibe check poll
- **Test PK Start**: Simulate a PK battle starting
- **Test Big Gift**: Simulate a high-value gift (5,000 diamonds)

Use these to see how each module responds before going live!

---

## 🔧 Technical Architecture

### Backend (Node.js + Express + WebSocket)
- `server/index.ts` - Main server and API
- `server/JefeBotCoordinator.ts` - Module orchestrator
- `server/modules/` - The four modules
  - `ElMusico.ts`
  - `ElAnunciador.ts`
  - `ElMaestroDelJuego.ts`
  - `ElHypeMan.ts`

### Frontend (React + TypeScript + Vite)
- `src/App.tsx` - Dashboard UI
- `src/App.css` - Neon orange, black & white styles
- Real-time WebSocket connection for live updates

### Module Coordination
- **Shared State**: All modules see the same room state
- **Smart Pausing**: Games pause during PKs automatically
- **Event-Driven**: Modules react to SUGO events in real-time

---

## 🎨 Dashboard Features

- **Real-time Status**: See what's playing, active games, and PKs
- **Live Configuration**: Change settings without restarting
- **Visual Feedback**: Neon orange glow on active elements
- **Responsive Design**: Works on laptop, tablet, and desktop
- **Connection Monitor**: Always know if you're connected
- **Rich Legacy Branding**: Black background, orange accents, white text

---

## 📝 SUGO API Integration

**Note**: This current implementation includes mock SUGO API calls. To connect to the real SUGO API:

1. Update the `sendToSUGO()` method in `server/JefeBotCoordinator.ts:115-130`
2. Implement SUGO event listeners for:
   - PK start/end events
   - Gift received events
   - Chat messages
3. Add SUGO authentication headers

Example (to be implemented):
```typescript
private async sendToSUGO(message: string): Promise<void> {
  await fetch(`https://api.sugo.com/rooms/${this.config.sugoRoomId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.config.botAccountToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message })
  });
}
```

### Finding SUGO API Endpoints

If SUGO doesn't have public documentation:

1. Use browser DevTools Network tab
2. Perform actions in SUGO (send message, start PK, send gift)
3. Look at the XHR/Fetch requests
4. Note the endpoint URLs and headers
5. Replicate those calls in the bot

---

## 🚨 Troubleshooting

### Bot won't start
- ✅ Check SUGO Room ID is correct
- ✅ Check Bot Account Token is valid
- ✅ Check backend server is running (`npm run server`)

### Spotify not working
- ✅ Token must be valid and not expired
- ✅ Spotify must be actively playing
- ✅ Token needs `user-read-currently-playing` scope
- ✅ Refresh token every hour (Spotify tokens expire)

### Games not starting
- ✅ Module must be enabled
- ✅ At least one game type must be checked
- ✅ Bot must be running
- ✅ No active PK (games pause during PKs)

### Bot messages not appearing in SUGO
- ✅ Verify your bot token has chat permissions
- ✅ Check that the SUGO API endpoint is correct
- ✅ Look at browser console for CORS errors
- ✅ Ensure bot account is not rate-limited

---

## 🎤 Philosophy: The Rich Legacy

You are **Rich $teve**—building a legacy one stream at a time. Your music is the vibe, and this bot is your voice. You control the show, play your tracks, and let the bot create the dinámica.

**This is not a tool. This is your co-host.**

**Colors**: Neon Orange (#FF5E00), Pure Black (#000000), Pure White (#FFFFFF)

---

## 📜 License

MIT License - Build, modify, and make it yours!

---

## 🤝 Contributing

Want to add new game types? Better Spotify integration? New announcement styles?

Fork it, build it, share it!

---

## 🔮 Future Enhancements

- OAuth 2.0 flow for Spotify (auto-refresh tokens)
- Full SUGO WebSocket integration
- Custom game creation in dashboard
- Message templates editor
- Analytics dashboard (gifts, engagement, peak times)
- Multi-language support
- Voice TTS announcements
- Integration with other music platforms (Apple Music, YouTube Music)

---

**Built for Rich $teve. Building the Legacy. 💰**
