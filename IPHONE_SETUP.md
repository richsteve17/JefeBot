# 📱 Rich $teve Bot - iPhone Quick Start

## Super Easy Setup (5 Minutes)

### Step 1: Run the Server (on your laptop/computer)

```bash
npm install
npm run server
```

Keep this running! The server needs to stay on while you use the bot.

### Step 2: Get Your Server's IP Address

**On Mac:**
```bash
ipconfig getifaddr en0
```

**On Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" (looks like `192.168.1.XXX`)

**On Linux:**
```bash
hostname -I
```

Example IP: `192.168.1.100`

### Step 3: Open on Your iPhone

1. Make sure your iPhone is on the **same WiFi** as your laptop
2. Open **Safari** on your iPhone
3. Go to: `http://YOUR-IP:3000`
   - Example: `http://192.168.1.100:3000`

### Step 4: Add to Home Screen (Makes it Feel Like an App!)

1. Tap the **Share** button (square with arrow)
2. Scroll down and tap **"Add to Home Screen"**
3. Name it "Rich $teve"
4. Tap **Add**

Now you have a Rich $teve app icon on your home screen! 💰

---

## Your SUGO Room

Your Room ID is already known: **1250911**

### To Get Your Bot Token:

1. Open SUGO on your phone
2. Open **Settings** > **Developer Tools** (or similar)
3. Find your **Bot Token** or **API Key**
4. Copy it

OR use the browser method from `SUGO_SETUP_GUIDE.md`

---

## Using the Dashboard on iPhone

### Mobile Layout:

Everything stacks vertically:
1. **Header** - Big Rich $teve title with orange glow
2. **Config** - Enter your SUGO credentials
3. **Power Button** - Big orange circle to START
4. **Four Module Cards** - Stack on top of each other
5. **Test Buttons** - Full width, easy to tap

### Tips:
- ✅ All buttons are touch-friendly (44px+ tap targets)
- ✅ Forms won't zoom when you type (optimized!)
- ✅ Scrolls smoothly
- ✅ Orange glow effects still work!
- ✅ Landscape mode supported

---

## Quick Commands

**On your laptop (where server runs):**

```bash
# Start everything
npm run server

# Check if it's running
curl http://localhost:3001/api/health

# See what IP to use on iPhone
# Mac:
ipconfig getifaddr en0

# Windows:
ipconfig

# Linux:
hostname -I
```

**On your iPhone:**

Just open Safari and go to `http://YOUR-IP:3000`

---

## Troubleshooting

### "Can't connect" on iPhone
- ✅ Make sure laptop and iPhone are on same WiFi
- ✅ Check if server is running on laptop
- ✅ Try the IP address again
- ✅ Disable any VPNs

### "Not loading"
- ✅ Make sure you're using port `:3000` in the URL
- ✅ Try refreshing the page
- ✅ Check laptop firewall settings

### "Looks weird"
- ✅ Make sure you're using **Safari** (not Chrome)
- ✅ Rotate to portrait mode
- ✅ Clear Safari cache

---

## What You'll See

```
┌─────────────────────────────┐
│  💰 RICH $TEVE BOT 💰       │
│  THE RICH LEGACY            │
│  🟠 Connected               │
└─────────────────────────────┘

┌─────────────────────────────┐
│  ⚙️ Configuration           │
│  SUGO Room ID: 1250911      │
│  Bot Token: [Enter]         │
│  Spotify Token: [Optional]  │
└─────────────────────────────┘

┌─────────────────────────────┐
│        ╭───────╮             │
│        │ START │  ← Big!     │
│        ╰───────╯             │
│     🟢 Bot is STOPPED        │
└─────────────────────────────┘

┌─────────────────────────────┐
│  🎧 El Músico         [OFF] │
│  Enable Vibe Check    ☐     │
└─────────────────────────────┘

┌─────────────────────────────┐
│  📢 El Anunciador     [OFF] │
└─────────────────────────────┘

┌─────────────────────────────┐
│  🎮 El Maestro        [OFF] │
│  Game Interval: 20 min      │
│  ☑ Gift Burst               │
│  ☑ Family Goal              │
│  ☑ King of the Hill         │
└─────────────────────────────┘

┌─────────────────────────────┐
│  🔥 El Hype Man       [OFF] │
│  Min Diamonds: 1000         │
└─────────────────────────────┘

┌─────────────────────────────┐
│  🧪 Test Controls           │
│  [Test Vibe Check]          │
│  [Test PK Start]            │
│  [Test Big Gift]            │
└─────────────────────────────┘
```

All **black background** with **neon orange borders** and **white text**!

---

## The Full Flow

1. **Laptop**: Run `npm run server`
2. **Laptop**: Get your IP with `ipconfig getifaddr en0`
3. **iPhone**: Open Safari → `http://YOUR-IP:3000`
4. **iPhone**: Add to home screen
5. **iPhone**: Enter SUGO Room ID: `1250911`
6. **iPhone**: Enter your bot token
7. **iPhone**: Tap the orange START button
8. **Done!** Bot is running, controlled from your phone! 💰

---

**Building the Legacy from your iPhone! 📱💰**
