# Ret Emote Bot

A Twitch bot that monitors chat for 7TV emotes and has a chance to respond with the detected emote.

## Features

- 🎯 Detects 7TV emotes in Twitch chat messages
- 🎲 Configurable chance-based response system
- ⏱️ Cooldown system to prevent spam
- 🔄 Auto-refreshes emote list every 5 minutes
- 📝 Detailed console logging

## Prerequisites

Before you begin, you need to install **Node.js** (which includes npm):

1. Download Node.js from [nodejs.org](https://nodejs.org/) (get the LTS version)
2. Run the installer and follow the setup wizard
3. Restart your terminal/command prompt after installation
4. Verify installation by running: `node --version` and `npm --version`

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create a Bot Account (Recommended)

**Yes, you need a separate Twitch account for the bot.** Here's why and how:

**Why a separate account?**
- Keeps your personal account separate from bot activity
- Prevents your personal account from appearing to spam chat
- Allows you to easily identify bot messages vs your own
- Better for moderation and channel management

**How to create one:**
1. Go to [Twitch Sign Up](https://www.twitch.tv/signup)
2. Create a new account (it's free!)
3. Choose a username like `YourChannelBot` or `YourChannelEmoteBot`
4. Verify the email address
5. **That's it!** No need to stream or do anything else with this account

**Alternative:** You *can* use your personal account, but it's not recommended as it will make your account appear to be sending automated messages in chat.

### 3. Get Twitch OAuth Token and Client ID

You need to generate an OAuth token and Client ID for your bot account:

1. **Make sure you're logged into your bot account** (not your personal account!)
2. Go to [Twitch Token Generator](https://twitchtokengenerator.com/)
3. Select the scopes:
   - `chat:read`
   - `chat:edit`
4. Click "Generate Token!" and authorize the application
5. Copy both:
   - **OAuth Access Token** (it will look like `oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - Make sure it includes the `oauth:` prefix
   - If it doesn't, add `oauth:` at the beginning
   - **Client ID** (shown in the next textbox)
6. **Important:** Keep these credentials secret! Don't share them or commit them to version control

**Note:** As of May 2024, Twitch requires a Client ID for all API calls, so make sure to get both the token and Client ID.

### 4. Create Configuration File

1. Copy `config.json.example` to `config.json`:
   ```bash
   copy config.json.example config.json
   ```

2. Edit `config.json` with your details:
   ```json
   {
     "username": "YourBotUsername",
     "oauth": "oauth:your_oauth_token_here",
     "clientId": "your_client_id_here",
     "channel": "channelname",
     "responseChance": 0.1,
     "cooldownSeconds": 30,
     "debug": false
   }
   ```

   - `username`: Your bot's Twitch username
   - `oauth`: The OAuth token from step 3 (must start with `oauth:`)
   - `clientId`: The Client ID from step 3 (required as of May 2024)
   - `channel`: The channel to monitor (without the #)
   - `responseChance`: Probability of responding (0.0 to 1.0, where 0.1 = 10% chance)
   - `cooldownSeconds`: Minimum seconds between responses
   - `debug`: Enable debug mode for more verbose logging

### 5. Run the Bot

```bash
npm start
```

## How It Works

1. The bot connects to the specified Twitch channel
2. It fetches all 7TV emotes for that channel
3. When a chat message is detected, it checks if any words match 7TV emote names
4. If an emote is found, it rolls a chance (default 10%) to respond
5. If successful, it sends the emote name in chat
6. The bot respects a cooldown period between responses

## Notes

- The bot only responds to 7TV emotes that are set up for the monitored channel
- 7TV emotes must be enabled for the channel you're monitoring
- The bot will automatically refresh the emote list every 5 minutes
- Make sure your bot account has permission to chat in the channel
- **Important:** If the channel has follower-only mode enabled, your bot account must follow the channel to be able to send messages

## Troubleshooting

- **"config.json not found"**: Make sure you've created `config.json` from the example file
- **"No 7TV emotes found"**: The channel may not have 7TV emotes set up, or the channel name might be incorrect
- **Connection issues**: Verify your OAuth token is correct and hasn't expired
- **Bot not responding**: Check that the response chance is set appropriately and cooldown has passed

## License

MIT

