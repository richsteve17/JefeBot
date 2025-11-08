# 🔑 SUGO Setup Guide for Rich $teve Bot

## Complete Guide to Getting Your SUGO Credentials

This guide will help you get the credentials needed to run Rich $teve Bot on SUGO.

---

## What You Need

1. **SUGO Room ID** - Your livestream room identifier
2. **Bot Account Token** - Authentication token for the bot

---

## Method 1: Official SUGO Bot API (Recommended)

### If SUGO has a Developer Portal:

1. **Create a Developer Account**
   - Visit SUGO's developer portal
   - Register for API access
   - Verify your email

2. **Create a Bot Application**
   - Click "Create New Application"
   - Name it "Rich $teve Bot"
   - Select permissions needed:
     - ✅ Send chat messages
     - ✅ Read chat messages
     - ✅ Read room events
     - ✅ Read gift events

3. **Get Your Credentials**
   - Copy your **Bot Token** (looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
   - Copy your **Room ID** from your profile settings

4. **Paste into Dashboard**
   - Start Rich $teve Bot
   - Paste Bot Token into "Bot Account Token"
   - Paste Room ID into "SUGO Room ID"
   - Click START

---

## Method 2: Extract from Browser (For Personal Use)

### If SUGO doesn't have a public API yet:

#### Step 1: Get Your Room ID

1. Open your SUGO profile
2. Start a livestream
3. Look at the URL:
   ```
   https://sugo.com/live/[YOUR-ROOM-ID-HERE]
   ```
4. Copy that ID

Alternative:
- Right-click on your stream preview
- Inspect element
- Look for `data-room-id` or similar attributes

#### Step 2: Extract Your Authentication Token

1. **Open SUGO in Chrome or Firefox**

2. **Open Developer Tools**:
   - Windows/Linux: Press `F12`
   - Mac: Press `Cmd + Option + I`

3. **Go to the "Network" tab**

4. **Send a test message in your chat**:
   - Type anything in your livestream chat
   - Press send

5. **Find the chat request**:
   - Look for a request named `send`, `message`, or `chat`
   - Click on it

6. **Copy the token**:
   - Go to "Headers" tab
   - Look for `Authorization` header
   - Copy the token (usually starts with `Bearer `)
   - Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

7. **Important**: Only copy the token part, not the word "Bearer"

#### Step 3: Find API Endpoints

While in Developer Tools:

1. **Watch the Network tab as you**:
   - Send a chat message
   - Receive a gift
   - Start/end a PK

2. **Note the URLs**:
   ```
   POST https://api.sugo.com/v1/chat/send
   GET  https://api.sugo.com/v1/events/stream
   POST https://api.sugo.com/v1/pk/start
   ```

3. **Update the bot code**:
   - Open `server/JefeBotCoordinator.ts`
   - Replace the mock API URL with the real one
   - Use the endpoints you discovered

---

## Method 3: Contact SUGO Support

For official, long-term use:

1. **Email SUGO Support**:
   ```
   To: support@sugo.com
   Subject: Bot API Access Request

   Hi SUGO Team,

   I'm interested in creating an automated engagement bot for my
   livestream. I would like to request API access for:

   - Sending automated chat messages
   - Reading room events (PKs, gifts)
   - Engaging my audience during streams

   My use case is personal/educational/commercial [choose one].

   Please let me know the process for getting bot credentials.

   Thanks,
   Rich $teve
   ```

2. **Wait for Response**:
   - They may ask about your use case
   - They'll provide official credentials
   - You might get access to official documentation

3. **Benefits**:
   - ✅ Official support
   - ✅ Higher rate limits
   - ✅ Won't violate ToS
   - ✅ Access to webhooks

---

## Security Best Practices

### DO:
- ✅ Keep your tokens secret
- ✅ Never commit tokens to GitHub
- ✅ Use `.env` files (already in `.gitignore`)
- ✅ Rotate tokens regularly
- ✅ Use HTTPS for all API calls

### DON'T:
- ❌ Share your tokens publicly
- ❌ Hardcode tokens in the code
- ❌ Use the same token for multiple bots
- ❌ Store tokens in plain text files

---

## Testing Your Credentials

### Quick Test:

1. Start the bot with your credentials
2. Click **Test Vibe Check** in the dashboard
3. Check if the message appears in your SUGO chat
4. If yes → Credentials work! ✅
5. If no → Check troubleshooting below

### Troubleshooting:

#### "Unauthorized" Error
- Your token expired or is invalid
- Re-extract the token from browser
- Make sure you copied the full token

#### "Room Not Found" Error
- Your Room ID is incorrect
- Double-check the URL or profile settings
- Make sure you're using the numeric ID, not username

#### "Forbidden" Error
- Your bot account doesn't have permissions
- Contact SUGO support for bot permissions
- Try using your main account token (for testing only)

#### Messages Not Appearing
- Check if SUGO API endpoint is correct
- Look for CORS errors in browser console
- Verify the message format matches SUGO's API

---

## Example .env File

Create a `.env` file in the project root:

```bash
# SUGO Configuration
SUGO_ROOM_ID=12345678
SUGO_BOT_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzNDU2In0...

# Spotify (Optional)
SPOTIFY_ACCESS_TOKEN=BQD4y8zX9K...

# Server
PORT=3001
```

**Never commit this file to git!** (It's already in `.gitignore`)

---

## API Endpoint Discovery

### Common SUGO API Patterns

Based on similar platforms, SUGO likely uses:

```
Base URL: https://api.sugo.com/v1/

Endpoints:
- POST /chat/send              # Send chat message
- GET  /room/:roomId/events    # Listen to room events
- GET  /room/:roomId/gifts     # Get gift events
- GET  /pk/:pkId               # Get PK details
- POST /pk/start               # Start a PK
```

### How to Find the Real Endpoints:

1. Use browser DevTools Network tab
2. Interact with SUGO normally
3. Look for XHR/Fetch requests
4. Note the URL patterns
5. Test with Postman or curl
6. Update the bot code

---

## Rate Limiting

### Avoid Getting Banned:

Most platforms have rate limits:
- **Chat**: ~1 message per second
- **API Calls**: ~60 requests per minute

### Bot Behavior:
- ✅ The bot already has delays built in
- ✅ Messages are spaced out (5+ seconds)
- ✅ Games run every 20+ minutes
- ✅ This mimics human behavior

### If Rate Limited:
- Increase delays in module settings
- Reduce game frequency
- Contact SUGO for higher limits

---

## Legal & ToS Compliance

### Before Running the Bot:

1. **Read SUGO's Terms of Service**
   - Check if automation is allowed
   - Look for bot policies

2. **Follow Community Guidelines**
   - Don't spam
   - Don't impersonate users
   - Don't manipulate metrics

3. **Be Transparent**
   - Let your audience know a bot is helping
   - Example: "[Rich$teve]" prefix shows it's automated

4. **Use Responsibly**
   - Engage your real audience
   - Don't fake engagement
   - Build genuine community

---

## Getting Help

### If You're Stuck:

1. **Check the main README.md**
   - Troubleshooting section
   - Common errors

2. **Search for SUGO API Documentation**
   - Google: "SUGO bot API documentation"
   - Check SUGO's developer portal
   - Look for community forums

3. **Ask SUGO Support**
   - They're usually helpful
   - Explain your use case
   - Be patient

4. **Community**
   - Check if other SUGO streamers use bots
   - Join SUGO Discord/communities
   - Share knowledge

---

## Quick Reference Card

```
┌─────────────────────────────────────────┐
│  RICH $TEVE BOT - QUICK SETUP          │
├─────────────────────────────────────────┤
│                                         │
│  1. Get SUGO Room ID from stream URL    │
│  2. Extract bot token from DevTools     │
│  3. (Optional) Get Spotify token        │
│  4. Enter credentials in dashboard      │
│  5. Click START BOT                     │
│  6. Test with "Test Vibe Check"         │
│  7. Go live and build the legacy!       │
│                                         │
└─────────────────────────────────────────┘
```

---

**Need help? The Rich Legacy supports you. 💰**

Good luck setting up your bot! 🚀
