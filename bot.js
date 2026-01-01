const tmi = require('tmi.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load configuration from environment variables (for deployment) or config.json (for local)
let config;
if (process.env.USERNAME && process.env.OAUTH && process.env.CLIENT_ID) {
    // Use environment variables (deployment)
    config = {
        username: process.env.USERNAME,
        oauth: process.env.OAUTH,
        clientId: process.env.CLIENT_ID,
        channel: process.env.CHANNEL || process.env.USERNAME,
        responseChance: parseFloat(process.env.RESPONSE_CHANCE) || 0.1,
        cooldownSeconds: parseInt(process.env.COOLDOWN_SECONDS) || 30,
        debug: process.env.DEBUG === 'true' || process.env.DEBUG === '1'
    };
} else {
    // Try to load from config.json (local development)
    try {
        config = require('./config.json');
    } catch (error) {
        console.error('Error: No configuration found!');
        console.error('Either set environment variables (USERNAME, OAUTH, CLIENT_ID, CHANNEL) or create config.json');
        process.exit(1);
    }
}

// Validate required config fields
if (!config.username || !config.oauth || !config.clientId) {
    console.error('Error: Missing required fields (username, oauth, clientId)');
    console.error('Set USERNAME, OAUTH, and CLIENT_ID environment variables or create config.json');
    process.exit(1);
}

// Configuration
const CHANNEL = config.channel || config.username; // Channel to monitor
const RESPONSE_CHANCE = config.responseChance || 0.1; // 10% chance by default (0.0 to 1.0)
const COOLDOWN_SECONDS = config.cooldownSeconds || 30; // Cooldown between responses

// Store 7TV emotes for the channel
// Map structure: lowercase name -> array of emotes with that name (different cases)
let channelEmotes = new Map();
// Also store exact case mapping for precise matching
let channelEmotesExact = new Map();
let lastResponseTime = 0;

// Track emote usage: emote name (lowercase) -> Set of usernames who sent it
let emoteUsage = new Map();
const MIN_USERS_FOR_RESPONSE = 3;

// Create Twitch client
// Note: tmi.js debug option logs all IRC messages, so we keep it false to avoid spam
const client = new tmi.Client({
    options: { debug: false },
    connection: {
        reconnect: false, // We'll handle reconnection manually based on stream status
        secure: true
    },
    identity: {
        username: config.username,
        password: config.oauth
    },
    channels: [CHANNEL]
});

// Store client ID for potential API calls (required by Twitch as of May 2024)
const CLIENT_ID = config.clientId;

// Track connection state
let isConnected = false;
let streamCheckInterval = null;

/**
 * Check if a Twitch channel is currently live
 */
async function isChannelLive(channelName) {
    try {
        const response = await axios.get(`https://api.twitch.tv/helix/streams`, {
            params: { user_login: channelName.toLowerCase() },
            headers: {
                'Client-ID': CLIENT_ID,
                'Authorization': `Bearer ${config.oauth.replace('oauth:', '')}`
            }
        });
        
        if (config.debug) {
            console.log(`Debug - Stream check for ${channelName}:`, {
                status: response.status,
                dataLength: response.data?.data?.length || 0,
                isLive: response.data && response.data.data && response.data.data.length > 0
            });
        }
        
        if (response.data && response.data.data && response.data.data.length > 0) {
            return true; // Channel is live
        }
        return false; // Channel is offline
    } catch (error) {
        // If OAuth fails, try with just Client ID
        try {
            const response = await axios.get(`https://api.twitch.tv/helix/streams`, {
                params: { user_login: channelName.toLowerCase() },
                headers: {
                    'Client-ID': CLIENT_ID
                }
            });
            
            if (config.debug) {
                console.log(`Debug - Stream check (Client ID only) for ${channelName}:`, {
                    status: response.status,
                    dataLength: response.data?.data?.length || 0,
                    isLive: response.data && response.data.data && response.data.data.length > 0
                });
            }
            
            if (response.data && response.data.data && response.data.data.length > 0) {
                return true;
            }
            return false;
        } catch (error2) {
            console.error(`✗ Error checking stream status for ${channelName}:`, error2.message);
            if (error2.response) {
                console.error(`  Status: ${error2.response.status}, Message: ${error2.response.statusText}`);
            }
            // If we can't check, assume offline to be safe
            return false;
        }
    }
}

/**
 * Get Twitch user ID from username
 */
async function getTwitchUserId(username) {
    try {
        // Try with OAuth token first
        const response = await axios.get(`https://api.twitch.tv/helix/users`, {
            params: { login: username.toLowerCase() },
            headers: {
                'Client-ID': CLIENT_ID,
                'Authorization': `Bearer ${config.oauth.replace('oauth:', '')}`
            }
        });
        
        if (response.data && response.data.data && response.data.data.length > 0) {
            return response.data.data[0].id;
        }
        return null;
    } catch (error) {
        // If OAuth fails, try with just Client ID (some endpoints work with this)
        try {
            const response = await axios.get(`https://api.twitch.tv/helix/users`, {
                params: { login: username.toLowerCase() },
                headers: {
                    'Client-ID': CLIENT_ID
                }
            });
            
            if (response.data && response.data.data && response.data.data.length > 0) {
                return response.data.data[0].id;
            }
        } catch (error2) {
            if (config.debug) {
                console.log('Debug - Could not fetch Twitch ID via API, will try username method');
            }
        }
        return null;
    }
}

/**
 * Fetch 7TV emotes for a channel
 */
async function fetch7TVEmotes(channelName) {
    try {
        const lowerChannelName = channelName.toLowerCase();
        console.log(`🔍 Fetching 7TV emotes for channel: ${channelName}...`);
        
        // First, try to get the Twitch user ID
        let twitchUserId = null;
        try {
            twitchUserId = await getTwitchUserId(channelName);
            if (twitchUserId && config.debug) {
                console.log(`Debug - Found Twitch ID for ${channelName}: ${twitchUserId}`);
            }
        } catch (error) {
            if (config.debug) {
                console.log(`Debug - Could not fetch Twitch ID, trying username method`);
            }
        }
        
        // Method 1: Try with Twitch ID if we have it, otherwise use username
        let userResponse;
        if (twitchUserId) {
            try {
                userResponse = await axios.get(`https://7tv.io/v3/users/twitch/${twitchUserId}`);
            } catch (error) {
                // Fallback to username if ID method fails
                userResponse = await axios.get(`https://7tv.io/v3/users/twitch/${lowerChannelName}`);
            }
        } else {
            userResponse = await axios.get(`https://7tv.io/v3/users/twitch/${lowerChannelName}`);
        }
        
        if (config.debug) {
            console.log('Debug - User response:', JSON.stringify(userResponse.data, null, 2));
        }
        
        if (userResponse.data) {
            const userData = userResponse.data;
            let emoteSetId = null;
            
            // Try different ways to get the emote set ID
            if (userData.emote_set && userData.emote_set.id) {
                emoteSetId = userData.emote_set.id;
            } else if (userData.emote_sets && userData.emote_sets.length > 0) {
                emoteSetId = userData.emote_sets[0].id;
            } else if (userData.connections && userData.connections.length > 0) {
                // Check connections for emote sets
                for (const connection of userData.connections) {
                    if (connection.emote_set && connection.emote_set.id) {
                        emoteSetId = connection.emote_set.id;
                        break;
                    }
                }
            }
            
            // Method 2: If we have a user ID, try getting emotes directly
            if (!emoteSetId && userData.id) {
                try {
                    const userEmotesResponse = await axios.get(`https://7tv.io/v3/users/${userData.id}/emotes`);
                    if (config.debug) {
                        console.log('Debug - Direct user emotes response:', JSON.stringify(userEmotesResponse.data, null, 2));
                    }
                    
                    if (userEmotesResponse.data && Array.isArray(userEmotesResponse.data) && userEmotesResponse.data.length > 0) {
                        channelEmotes.clear();
                        channelEmotesExact.clear();
                        userEmotesResponse.data.forEach(emote => {
                            const emoteName = emote.name || emote.data?.name;
                            if (emoteName) {
                                const emoteData = {
                                    name: emoteName,
                                    id: emote.id,
                                    animated: emote.data?.animated || emote.animated || false
                                };
                                
                                // Store exact case mapping
                                channelEmotesExact.set(emoteName, emoteData);
                                
                                // Store case-insensitive mapping (may have multiple emotes with same lowercase name)
                                const lowerName = emoteName.toLowerCase();
                                if (!channelEmotes.has(lowerName)) {
                                    channelEmotes.set(lowerName, []);
                                }
                                channelEmotes.get(lowerName).push(emoteData);
                            }
                        });
                        console.log(`✓ Loaded ${channelEmotesExact.size} 7TV emotes for ${channelName} (direct method)`);
                        return true;
                    }
                } catch (directError) {
                    if (config.debug) {
                        console.log('Debug - Direct emotes fetch failed:', directError.message);
                    }
                }
            }
            
            // Method 3: Get emotes from emote set
            if (emoteSetId) {
                const emoteResponse = await axios.get(`https://7tv.io/v3/emote-sets/${emoteSetId}`);
                
                if (config.debug) {
                    console.log('Debug - Emote set response:', JSON.stringify(emoteResponse.data, null, 2));
                }
                
                if (emoteResponse.data) {
                    const emotes = emoteResponse.data.emotes || emoteResponse.data;
                    
                    if (Array.isArray(emotes) && emotes.length > 0) {
                        channelEmotes.clear();
                        channelEmotesExact.clear();
                        emotes.forEach(emote => {
                            const emoteName = emote.name || emote.data?.name;
                            if (emoteName) {
                                const emoteData = {
                                    name: emoteName,
                                    id: emote.id || emote.data?.id,
                                    animated: emote.data?.animated || emote.animated || false
                                };
                                
                                // Store exact case mapping
                                channelEmotesExact.set(emoteName, emoteData);
                                
                                // Store case-insensitive mapping (may have multiple emotes with same lowercase name)
                                const lowerName = emoteName.toLowerCase();
                                if (!channelEmotes.has(lowerName)) {
                                    channelEmotes.set(lowerName, []);
                                }
                                channelEmotes.get(lowerName).push(emoteData);
                            }
                        });
                        console.log(`✓ Loaded ${channelEmotesExact.size} 7TV emotes for ${channelName}`);
                        return true;
                    }
                }
            }
        }
        
        console.log(`⚠ No 7TV emotes found for ${channelName}`);
        console.log(`   Tip: Make sure the channel has 7TV enabled and has emotes set up.`);
        console.log(`   You can check at: https://7tv.io/users/${lowerChannelName}`);
        return false;
    } catch (error) {
        if (error.response) {
            if (error.response.status === 404) {
                console.log(`⚠ Channel ${channelName} not found on 7TV or has no emotes`);
                console.log(`   The channel may not have 7TV enabled.`);
                console.log(`   Check if the channel exists on 7TV: https://7tv.io/users/${channelName.toLowerCase()}`);
            } else {
                console.error(`✗ Error fetching 7TV emotes (Status ${error.response.status}):`, error.response.statusText);
                if (config.debug) {
                    console.error('Debug - Error response:', JSON.stringify(error.response.data, null, 2));
                }
            }
        } else {
            console.error(`✗ Error fetching 7TV emotes:`, error.message);
            if (config.debug) {
                console.error('Debug - Full error:', error);
            }
        }
        return false;
    }
}

/**
 * Check if a message contains any 7TV emotes
 * Returns emotes with exact case matching when possible
 */
function detect7TVEmotes(message) {
    const foundEmotes = [];
    // Split message into words, preserving original case
    const words = message.split(/\s+/);
    
    for (const word of words) {
        // Remove common punctuation but preserve case
        const cleanWord = word.replace(/[.,!?;:()\[\]{}'"]/g, '');
        if (!cleanWord) continue;
        
        // First, try exact case match
        if (channelEmotesExact.has(cleanWord)) {
            foundEmotes.push(channelEmotesExact.get(cleanWord));
            continue;
        }
        
        // If no exact match, try case-insensitive match
        const lowerWord = cleanWord.toLowerCase();
        if (channelEmotes.has(lowerWord)) {
            const matchingEmotes = channelEmotes.get(lowerWord);
            // If multiple emotes with same lowercase name, prefer the one that matches the original word's case pattern
            // Otherwise, just use the first one
            if (matchingEmotes.length === 1) {
                foundEmotes.push(matchingEmotes[0]);
            } else {
                // Try to find one that matches the capitalization pattern
                // For example, if word is "awarE", prefer "awarE" over "Aware"
                const exactMatch = matchingEmotes.find(e => e.name === cleanWord);
                if (exactMatch) {
                    foundEmotes.push(exactMatch);
                } else {
                    // If no exact match, use the first one (but this shouldn't happen if we stored correctly)
                    foundEmotes.push(matchingEmotes[0]);
                }
            }
        }
    }
    
    return foundEmotes;
}

/**
 * Decide if bot should respond (based on chance and cooldown)
 */
function shouldRespond() {
    const now = Date.now();
    const timeSinceLastResponse = (now - lastResponseTime) / 1000;
    
    // Check cooldown
    if (timeSinceLastResponse < COOLDOWN_SECONDS) {
        return false;
    }
    
    // Check chance
    return Math.random() < RESPONSE_CHANCE;
}

/**
 * Send a message with the emote
 */
function sendEmoteResponse(emote, originalMessage, username) {
    // Set cooldown immediately to prevent multiple messages from being queued
    lastResponseTime = Date.now();
    
    // Format: emote name (7TV emotes appear as :emoteName: in Twitch chat)
    const message = emote.name;
    
    // Random delay between 1-2 seconds (1000-2000ms)
    const delay = Math.floor(Math.random() * 1000) + 1000;
    
    setTimeout(() => {
        client.say(CHANNEL, message)
            .then(() => {
                console.log(`📝 ${username}: "${originalMessage}"`);
                console.log(`✓ Bot sent: "${message}"`);
            })
            .catch((error) => {
                console.error(`✗ Error sending message:`, error);
                // Reset cooldown on error so it can try again
                lastResponseTime = 0;
            });
    }, delay);
}

// Event handlers
client.on('message', async (channel, tags, message, self) => {
    // Ignore messages from the bot itself
    if (self) return;
    
    // Detect 7TV emotes in the message
    const foundEmotes = detect7TVEmotes(message);
    
    if (foundEmotes.length > 0) {
        const username = tags.username || tags['display-name'] || 'Unknown';
        
        // Track emote usage for each emote found
        for (const emote of foundEmotes) {
            const emoteKey = emote.name.toLowerCase();
            
            // Initialize tracking for this emote if not exists
            if (!emoteUsage.has(emoteKey)) {
                emoteUsage.set(emoteKey, new Set());
            }
            
            // Add this user to the set (Set automatically handles duplicates)
            emoteUsage.get(emoteKey).add(username);
            
            // Check if this emote has been sent by at least 3 different users
            const userCount = emoteUsage.get(emoteKey).size;
            
            if (userCount >= MIN_USERS_FOR_RESPONSE) {
                // Check if we should respond (chance + cooldown)
                if (shouldRespond()) {
                    // Clear the tracking for this emote after responding
                    emoteUsage.delete(emoteKey);
                    
                    // Send the response
                    sendEmoteResponse(emote, message, username);
                    break; // Only respond to one emote per message
                }
            }
        }
    }
});

client.on('connected', async (addr, port) => {
    isConnected = true;
    console.log(`✓ Connected to Twitch at ${addr}:${port}`);
    console.log(`📺 Monitoring channel: ${CHANNEL}`);
    
    // Fetch 7TV emotes for the channel
    await fetch7TVEmotes(CHANNEL);
    
    // Refresh emotes every 5 minutes (in case new ones are added)
    setInterval(async () => {
        if (config.debug) {
            console.log('🔄 Refreshing 7TV emotes...');
        }
        await fetch7TVEmotes(CHANNEL);
    }, 5 * 60 * 1000);
});

client.on('disconnected', (reason) => {
    isConnected = false;
    console.log(`✗ Disconnected: ${reason}`);
});

// Handle errors
client.on('error', (error) => {
    console.error('✗ Error:', error);
});


/**
 * Check stream status and connect/disconnect accordingly
 */
async function checkStreamAndConnect() {
    const isLive = await isChannelLive(CHANNEL);
    
    if (isLive) {
        if (!isConnected) {
            console.log(`🔴 Channel ${CHANNEL} is LIVE - Connecting bot...`);
            try {
                await client.connect();
            } catch (error) {
                console.error('✗ Error connecting:', error.message);
            }
        }
    } else {
        if (isConnected) {
            console.log(`⚫ Channel ${CHANNEL} went OFFLINE - Disconnecting bot...`);
            try {
                await client.disconnect();
            } catch (error) {
                console.error('✗ Error disconnecting:', error.message);
            }
        }
    }
}

// Start the bot
async function startBot() {
    console.log('🚀 Starting Twitch bot...');
    console.log(`📺 Will only run when ${CHANNEL} is live`);

    // Test the API first to verify it's working
    // Check stream status immediately
    await checkStreamAndConnect();

    // Check stream status every 30 seconds
    streamCheckInterval = setInterval(async () => {
        await checkStreamAndConnect();
    }, 30 * 1000); // Check every 30 seconds
}

// Start the bot
startBot().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down bot...');
    if (streamCheckInterval) {
        clearInterval(streamCheckInterval);
    }
    if (isConnected) {
        client.disconnect();
    }
    process.exit(0);
});

