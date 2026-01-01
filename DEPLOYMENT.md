# Deployment Guide

This Twitch bot needs to run continuously to maintain a connection to Twitch chat. Here are the best **COMPLETELY FREE** hosting options:

## 🪶 Fly.io (Best Free Option - Recommended)

**Free tier:** 3 shared-cpu VMs, 3GB persistent volumes, 160GB outbound data transfer/month

1. Install Fly CLI: 
   - Windows: `iwr https://fly.io/install.ps1 -useb | iex`
   - Mac/Linux: `curl -L https://fly.io/install.sh | sh`
2. Sign up at [fly.io](https://fly.io) (free account)
3. Run: `fly auth signup` (or `fly auth login` if you already have an account)
4. In your project directory, run: `fly launch`
5. Follow the prompts (say no to Postgres, Redis, etc.)
6. Set secrets:
   ```bash
   fly secrets set USERNAME=your_username OAUTH=oauth:your_token CLIENT_ID=your_id CHANNEL=channelname RESPONSE_CHANCE=0.1 COOLDOWN_SECONDS=15 DEBUG=false
   ```
7. Deploy: `fly deploy`
8. Your bot will run 24/7 for free!

**Note:** Free tier has some limits, but should be plenty for a Twitch bot.

## 🎨 Render (Free but Spins Down)

**Free tier:** Spins down after 15 minutes of inactivity, but wakes up on first request

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Settings:
   - **Name:** ret-emote-bot
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node bot.js`
   - **Plan:** Free
5. Add environment variables:
   - `USERNAME` = your bot username
   - `OAUTH` = your oauth token (with `oauth:` prefix)
   - `CLIENT_ID` = your client ID
   - `CHANNEL` = channel to monitor
   - `RESPONSE_CHANCE` = 0.1
   - `COOLDOWN_SECONDS` = 15
   - `DEBUG` = false
6. Click "Create Web Service"

**Note:** Free tier spins down after inactivity. For 24/7 operation, consider upgrading or use Fly.io.

## 🚂 Railway (Not Completely Free)

**Free tier:** $5 credit/month (runs out eventually)

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select this repository
4. Add environment variables:
   - Go to your project → Variables tab
   - Add these variables (copy from your `config.json`):
     - `USERNAME` = your bot username
     - `OAUTH` = your oauth token (with `oauth:` prefix)
     - `CLIENT_ID` = your client ID
     - `CHANNEL` = channel to monitor
     - `RESPONSE_CHANCE` = 0.1
     - `COOLDOWN_SECONDS` = 15
     - `DEBUG` = false
5. Railway will automatically deploy and keep your bot running!

## 🎨 Render

**Free tier:** Available (with limitations)

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Settings:
   - **Name:** ret-emote-bot
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node bot.js`
   - **Plan:** Free
5. Add environment variables (same as Railway above)
6. Click "Create Web Service"

**Note:** Free tier on Render may spin down after inactivity. Consider upgrading to paid for 24/7 uptime.

## 🪶 Fly.io

**Free tier:** Available

1. Install Fly CLI: `npm install -g @fly/cli`
2. Sign up at [fly.io](https://fly.io)
3. Run: `fly launch`
4. Follow the prompts
5. Set secrets: `fly secrets set USERNAME=your_username OAUTH=oauth:your_token CLIENT_ID=your_id CHANNEL=channelname`
6. Deploy: `fly deploy`

## 📝 Environment Variables

Instead of `config.json`, you'll need to set these as environment variables:

- `USERNAME` - Bot's Twitch username
- `OAUTH` - OAuth token (with `oauth:` prefix)
- `CLIENT_ID` - Client ID
- `CHANNEL` - Channel to monitor
- `RESPONSE_CHANCE` - Response probability (0.0-1.0)
- `COOLDOWN_SECONDS` - Cooldown between responses
- `DEBUG` - Enable debug mode (true/false)

## 🔧 Updating the Bot for Deployment

The bot needs to be updated to read from environment variables instead of `config.json`. See the updated `bot.js` file.

## 💡 Alternative: VPS

For full control, consider a VPS:
- **DigitalOcean Droplet:** $4-6/month
- **Linode:** $5/month
- **Vultr:** $2.50-6/month

These give you a full Linux server where you can run the bot directly.

