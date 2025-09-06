const express = require('express');
const app = express();
const Eris = require('eris');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// Bot configuration
const bot = new Eris(process.env.DISCORD_BOT_TOKEN, {
    restMode: true,
    intents: [
        'guilds', 
        'guildMessages', 
        'messageContent', 
        'guildMembers',
        'guildBans',
        'guildVoiceStates',
        'messageReactions'
    ]
});

const config = {
    prefix: 'n!',
    authorizedUsers: [
        '834351934495260673',
        '558664937061482516'
    ],
    targetChannelId: '1378173296973189160',
    robloxApiUrl: 'https://groups.roblox.com/v1/groups/36047451',
    languages: {
        en: 'English',
        tr: 'Türkçe'
    },
    colors: {
        success: 0x00ff00,
        error: 0xff0000,
        info: 0x0099ff,
        warning: 0xff9900
    }
};

// Data storage
const userData = new Map();
const guildSettings = new Map();
const warnings = new Map();
const economy = new Map();
const reminders = new Map();
let startTime = Date.now();

// Language system
const lang = {
    en: {
        unauthorized: "❌ You don't have permission to use this command!",
        invalidCommand: "❌ Invalid command: `{command}`. Did you mean: `{suggestion}`?",
        commandList: "❌ Invalid command: `{command}`. Valid commands: {commands}",
        ping: "🏓 Pong! Latency: {latency}ms",
        uptime: "⏰ Bot uptime: {uptime}",
        help: "📋 Available commands: {commands}",
        userNotFound: "❌ User not found!",
        error: "❌ An error occurred: {error}",
        success: "✅ {message}",
        memberKicked: "User {user} has been kicked. Reason: {reason}",
        memberBanned: "User {user} has been banned. Reason: {reason}",
        memberUnbanned: "User {user} has been unbanned.",
        noPermission: "❌ I don't have permission to perform this action!",
        balance: "💰 Balance for {user}: {amount} coins",
        dailyClaimed: "💰 Daily reward claimed! +100 coins. New balance: {balance}",
        dailyAlready: "⏰ You already claimed your daily reward! Come back tomorrow.",
        transferSuccess: "💰 Transferred {amount} coins to {user}",
        insufficientFunds: "❌ Insufficient funds!",
        weather: "🌤️ Weather in {city}: {description}, {temp}°C"
    },
    tr: {
        unauthorized: "❌ Bu komutu kullanma yetkiniz yok!",
        invalidCommand: "❌ Geçersiz komut: `{command}`. Şunu mu kastettiniz: `{suggestion}`?",
        commandList: "❌ Geçersiz komut: `{command}`. Geçerli komutlar: {commands}",
        ping: "🏓 Pong! Gecikme: {latency}ms",
        uptime: "⏰ Bot çalışma süresi: {uptime}",
        help: "📋 Kullanılabilir komutlar: {commands}",
        userNotFound: "❌ Kullanıcı bulunamadı!",
        error: "❌ Bir hata oluştu: {error}",
        success: "✅ {message}",
        memberKicked: "{user} kullanıcısı atıldı. Sebep: {reason}",
        memberBanned: "{user} kullanıcısı yasaklandı. Sebep: {reason}",
        memberUnbanned: "{user} kullanıcısının yasağı kaldırıldı.",
        noPermission: "❌ Bu işlemi gerçekleştirmek için yetkim yok!",
        balance: "💰 {user} bakiyesi: {amount} coin",
        dailyClaimed: "💰 Günlük ödül alındı! +100 coin. Yeni bakiye: {balance}",
        dailyAlready: "⏰ Günlük ödülünüzü zaten aldınız! Yarın tekrar gelin.",
        transferSuccess: "💰 {user} kullanıcısına {amount} coin gönderildi",
        insufficientFunds: "❌ Yetersiz bakiye!",
        weather: "🌤️ {city} hava durumu: {description}, {temp}°C"
    }
};

// Commands system
const commands = {
    // Basic commands
    ping: {
        description: { en: "Check bot latency", tr: "Bot gecikmesini kontrol et" },
        usage: "ping",
        category: "basic",
        execute: async (msg, args, userLang) => {
            const start = Date.now();
            const message = await msg.channel.createMessage("🏓 Pong!");
            const latency = Date.now() - start;
            await message.edit(getMessage(userLang, 'ping', { latency }));
        }
    },
    
    uptime: {
        description: { en: "Show bot uptime", tr: "Bot çalışma süresini göster" },
        usage: "uptime",
        category: "basic",
        execute: async (msg, args, userLang) => {
            const uptimeMs = Date.now() - startTime;
            const uptime = formatUptime(uptimeMs, userLang);
            await msg.channel.createMessage(getMessage(userLang, 'uptime', { uptime }));
        }
    },
    
    help: {
        description: { en: "Show command list", tr: "Komut listesini göster" },
        usage: "help [command]",
        category: "basic",
        execute: async (msg, args, userLang) => {
            if (args[0]) {
                const cmd = commands[args[0]];
                if (!cmd) {
                    await msg.channel.createMessage("❌ Command not found!");
                    return;
                }
                
                const embed = {
                    title: `📋 ${args[0]}`,
                    description: cmd.description[userLang] || cmd.description.en,
                    fields: [
                        { name: "Usage", value: `${config.prefix}${cmd.usage}`, inline: true },
                        { name: "Category", value: cmd.category, inline: true }
                    ],
                    color: config.colors.info
                };
                
                await msg.channel.createMessage({ embeds: [embed] });
            } else {
                const categories = {};
                Object.entries(commands).forEach(([name, cmd]) => {
                    if (!categories[cmd.category]) categories[cmd.category] = [];
                    categories[cmd.category].push(name);
                });
                
                const embed = {
                    title: "📋 Command List / Komut Listesi",
                    fields: Object.entries(categories).map(([cat, cmds]) => ({
                        name: cat.charAt(0).toUpperCase() + cat.slice(1),
                        value: cmds.map(c => `\`${config.prefix}${c}\``).join(', '),
                        inline: false
                    })),
                    color: config.colors.info,
                    footer: { text: `Use ${config.prefix}help <command> for more info` }
                };
                
                await msg.channel.createMessage({ embeds: [embed] });
            }
        }
    },
    
    // Moderation commands
    kick: {
        description: { en: "Kick a member", tr: "Bir üyeyi at" },
        usage: "kick <@user> [reason]",
        category: "moderation",
        execute: async (msg, args, userLang) => {
            if (!msg.member.permissions.has('kickMembers')) {
                await msg.channel.createMessage(getMessage(userLang, 'noPermission'));
                return;
            }
            
            const user = msg.mentions[0];
            if (!user) {
                await msg.channel.createMessage(getMessage(userLang, 'userNotFound'));
                return;
            }
            
            const reason = args.slice(1).join(' ') || 'No reason provided';
            
            try {
                await msg.channel.guild.kickMember(user.id, reason);
                await msg.channel.createMessage(getMessage(userLang, 'memberKicked', { 
                    user: user.username, 
                    reason 
                }));
            } catch (error) {
                await msg.channel.createMessage(getMessage(userLang, 'error', { error: error.message }));
            }
        }
    },
    
    ban: {
        description: { en: "Ban a member", tr: "Bir üyeyi yasakla" },
        usage: "ban <@user> [reason]",
        category: "moderation",
        execute: async (msg, args, userLang) => {
            if (!msg.member.permissions.has('banMembers')) {
                await msg.channel.createMessage(getMessage(userLang, 'noPermission'));
                return;
            }
            
            const user = msg.mentions[0];
            if (!user) {
                await msg.channel.createMessage(getMessage(userLang, 'userNotFound'));
                return;
            }
            
            const reason = args.slice(1).join(' ') || 'No reason provided';
            
            try {
                await msg.channel.guild.banMember(user.id, 0, reason);
                await msg.channel.createMessage(getMessage(userLang, 'memberBanned', { 
                    user: user.username, 
                    reason 
                }));
            } catch (error) {
                await msg.channel.createMessage(getMessage(userLang, 'error', { error: error.message }));
            }
        }
    },
    
    warn: {
        description: { en: "Warn a member", tr: "Bir üyeyi uyar" },
        usage: "warn <@user> <reason>",
        category: "moderation",
        execute: async (msg, args, userLang) => {
            const user = msg.mentions[0];
            if (!user) {
                await msg.channel.createMessage(getMessage(userLang, 'userNotFound'));
                return;
            }
            
            const reason = args.slice(1).join(' ');
            if (!reason) {
                await msg.channel.createMessage("❌ Please provide a reason!");
                return;
            }
            
            if (!warnings.has(user.id)) warnings.set(user.id, []);
            warnings.get(user.id).push({
                reason,
                moderator: msg.author.id,
                timestamp: Date.now()
            });
            
            await msg.channel.createMessage(`⚠️ ${user.username} has been warned. Reason: ${reason}`);
        }
    },
    
    warnings: {
        description: { en: "Show user warnings", tr: "Kullanıcı uyarılarını göster" },
        usage: "warnings <@user>",
        category: "moderation",
        execute: async (msg, args, userLang) => {
            const user = msg.mentions[0] || msg.author;
            const userWarnings = warnings.get(user.id) || [];
            
            if (userWarnings.length === 0) {
                await msg.channel.createMessage(`✅ ${user.username} has no warnings.`);
                return;
            }
            
            const embed = {
                title: `⚠️ Warnings for ${user.username}`,
                fields: userWarnings.map((w, i) => ({
                    name: `Warning ${i + 1}`,
                    value: `Reason: ${w.reason}\nDate: ${new Date(w.timestamp).toLocaleString()}`,
                    inline: false
                })),
                color: config.colors.warning
            };
            
            await msg.channel.createMessage({ embeds: [embed] });
        }
    },
    
    // Utility commands
    userinfo: {
        description: { en: "Show user information", tr: "Kullanıcı bilgilerini göster" },
        usage: "userinfo [@user]",
        category: "utility",
        execute: async (msg, args, userLang) => {
            const user = msg.mentions[0] || msg.author;
            const member = msg.channel.guild.members.get(user.id);
            
            const embed = {
                title: `👤 ${user.username}#${user.discriminator}`,
                thumbnail: { url: user.avatarURL || user.defaultAvatarURL },
                fields: [
                    { name: "ID", value: user.id, inline: true },
                    { name: "Created", value: new Date(user.createdAt).toLocaleDateString(), inline: true },
                    { name: "Joined", value: member ? new Date(member.joinedAt).toLocaleDateString() : "N/A", inline: true },
                    { name: "Bot", value: user.bot ? "Yes" : "No", inline: true }
                ],
                color: config.colors.info
            };
            
            await msg.channel.createMessage({ embeds: [embed] });
        }
    },
    
    serverinfo: {
        description: { en: "Show server information", tr: "Sunucu bilgilerini göster" },
        usage: "serverinfo",
        category: "utility",
        execute: async (msg, args, userLang) => {
            const guild = msg.channel.guild;
            
            const embed = {
                title: `🏰 ${guild.name}`,
                thumbnail: { url: guild.iconURL || undefined },
                fields: [
                    { name: "ID", value: guild.id, inline: true },
                    { name: "Owner", value: `<@${guild.ownerID}>`, inline: true },
                    { name: "Members", value: guild.memberCount.toString(), inline: true },
                    { name: "Channels", value: guild.channels.size.toString(), inline: true },
                    { name: "Roles", value: guild.roles.size.toString(), inline: true },
                    { name: "Created", value: new Date(guild.createdAt).toLocaleDateString(), inline: true }
                ],
                color: config.colors.info
            };
            
            await msg.channel.createMessage({ embeds: [embed] });
        }
    },
    
    avatar: {
        description: { en: "Show user avatar", tr: "Kullanıcı avatarını göster" },
        usage: "avatar [@user]",
        category: "utility",
        execute: async (msg, args, userLang) => {
            const user = msg.mentions[0] || msg.author;
            
            const embed = {
                title: `🖼️ ${user.username}'s Avatar`,
                image: { url: user.avatarURL || user.defaultAvatarURL },
                color: config.colors.info
            };
            
            await msg.channel.createMessage({ embeds: [embed] });
        }
    },
    
    // Fun commands
    dice: {
        description: { en: "Roll a dice", tr: "Zar at" },
        usage: "dice [sides]",
        category: "fun",
        execute: async (msg, args, userLang) => {
            const sides = parseInt(args[0]) || 6;
            const result = Math.floor(Math.random() * sides) + 1;
            await msg.channel.createMessage(`🎲 You rolled a ${result}!`);
        }
    },
    
    coinflip: {
        description: { en: "Flip a coin", tr: "Yazı tura at" },
        usage: "coinflip",
        category: "fun",
        execute: async (msg, args, userLang) => {
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            const emoji = result === 'Heads' ? '🪙' : '🪙';
            await msg.channel.createMessage(`${emoji} ${result}!`);
        }
    },
    
    joke: {
        description: { en: "Get a random joke", tr: "Rastgele şaka al" },
        usage: "joke",
        category: "fun",
        execute: async (msg, args, userLang) => {
            try {
                const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
                const joke = response.data;
                await msg.channel.createMessage(`😄 ${joke.setup}\n\n||${joke.punchline}||`);
            } catch (error) {
                await msg.channel.createMessage("❌ Couldn't fetch a joke right now!");
            }
        }
    },
    
    // Economy commands
    balance: {
        description: { en: "Check your balance", tr: "Bakiyeni kontrol et" },
        usage: "balance [@user]",
        category: "economy",
        execute: async (msg, args, userLang) => {
            const user = msg.mentions[0] || msg.author;
            const balance = getBalance(user.id);
            await msg.channel.createMessage(getMessage(userLang, 'balance', { 
                user: user.username, 
                amount: balance 
            }));
        }
    },
    
    daily: {
        description: { en: "Claim daily reward", tr: "Günlük ödül al" },
        usage: "daily",
        category: "economy",
        execute: async (msg, args, userLang) => {
            const userId = msg.author.id;
            const lastDaily = userData.get(userId)?.lastDaily || 0;
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            
            if (now - lastDaily < oneDay) {
                await msg.channel.createMessage(getMessage(userLang, 'dailyAlready'));
                return;
            }
            
            addBalance(userId, 100);
            setUserData(userId, 'lastDaily', now);
            const newBalance = getBalance(userId);
            
            await msg.channel.createMessage(getMessage(userLang, 'dailyClaimed', { balance: newBalance }));
        }
    },
    
    transfer: {
        description: { en: "Transfer coins to another user", tr: "Başka kullanıcıya coin gönder" },
        usage: "transfer <@user> <amount>",
        category: "economy",
        execute: async (msg, args, userLang) => {
            const user = msg.mentions[0];
            const amount = parseInt(args[1]);
            
            if (!user || !amount || amount <= 0) {
                await msg.channel.createMessage("❌ Usage: `transfer @user amount`");
                return;
            }
            
            if (getBalance(msg.author.id) < amount) {
                await msg.channel.createMessage(getMessage(userLang, 'insufficientFunds'));
                return;
            }
            
            addBalance(msg.author.id, -amount);
            addBalance(user.id, amount);
            
            await msg.channel.createMessage(getMessage(userLang, 'transferSuccess', { 
                user: user.username, 
                amount 
            }));
        }
    },
    
    // Weather command
    weather: {
        description: { en: "Get weather information", tr: "Hava durumu bilgisi al" },
        usage: "weather <city>",
        category: "utility",
        execute: async (msg, args, userLang) => {
            if (!args[0]) {
                await msg.channel.createMessage("❌ Please provide a city name!");
                return;
            }
            
            const city = args.join(' ');
            try {
                // Using a free weather API (you'll need to get an API key)
                const apiKey = process.env.WEATHER_API_KEY;
                if (!apiKey) {
                    await msg.channel.createMessage("❌ Weather service not configured!");
                    return;
                }
                
                const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`);
                const weather = response.data;
                
                await msg.channel.createMessage(getMessage(userLang, 'weather', {
                    city: weather.name,
                    description: weather.weather[0].description,
                    temp: Math.round(weather.main.temp)
                }));
            } catch (error) {
                await msg.channel.createMessage("❌ Couldn't fetch weather data!");
            }
        }
    },
    
    // Language command
    language: {
        description: { en: "Change language", tr: "Dil değiştir" },
        usage: "language <en|tr>",
        category: "utility",
        execute: async (msg, args, userLang) => {
            const newLang = args[0];
            if (!newLang || !config.languages[newLang]) {
                await msg.channel.createMessage("❌ Available languages: `en`, `tr`");
                return;
            }
            
            setUserData(msg.author.id, 'language', newLang);
            await msg.channel.createMessage(`✅ Language changed to ${config.languages[newLang]}!`);
        }
    }
};

// Helper functions
function getMessage(language, key, params = {}) {
    let message = lang[language][key] || lang.en[key] || key;
    
    Object.entries(params).forEach(([param, value]) => {
        message = message.replace(`{${param}}`, value);
    });
    
    return message;
}

function formatUptime(ms, language) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    const parts = [];
    if (days > 0) parts.push(`${days} ${language === 'tr' ? 'gün' : 'days'}`);
    if (hours > 0) parts.push(`${hours} ${language === 'tr' ? 'saat' : 'hours'}`);
    if (minutes > 0) parts.push(`${minutes} ${language === 'tr' ? 'dakika' : 'minutes'}`);
    if (seconds > 0) parts.push(`${seconds} ${language === 'tr' ? 'saniye' : 'seconds'}`);
    
    return parts.join(', ') || `0 ${language === 'tr' ? 'saniye' : 'seconds'}`;
}

function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + indicator
            );
        }
    }
    
    return matrix[b.length][a.length];
}

function suggestCommand(input) {
    const commandNames = Object.keys(commands);
    const threshold = 3;
    let closest = commandNames[0];
    let minDistance = levenshteinDistance(input, closest);
    
    for (const cmd of commandNames) {
        const distance = levenshteinDistance(input, cmd);
        if (distance < minDistance) {
            minDistance = distance;
            closest = cmd;
        }
    }
    
    return minDistance <= threshold ? closest : null;
}

function getUserLanguage(userId) {
    return userData.get(userId)?.language || 'en';
}

function setUserData(userId, key, value) {
    if (!userData.has(userId)) userData.set(userId, {});
    userData.get(userId)[key] = value;
}

function getBalance(userId) {
    return economy.get(userId) || 0;
}

function addBalance(userId, amount) {
    const current = getBalance(userId);
    economy.set(userId, current + amount);
}

// Roblox member count updater
async function updateMemberCount() {
    try {
        const guild = bot.guilds.values().next().value;
        if (!guild) return;
        
        const voiceChannel = guild.channels.get(config.targetChannelId);
        if (!voiceChannel || voiceChannel.type !== 2) return;
        
        const response = await axios.get(config.robloxApiUrl);
        const memberCount = response.data.memberCount || 'N/A';
        
        await voiceChannel.edit({ name: `Member-Count: ${memberCount}` });
        console.log(`✅ Channel updated: Member-Count: ${memberCount}`);
    } catch (error) {
        console.error('❌ Roblox API error:', error.message);
        try {
            const guild = bot.guilds.values().next().value;
            const voiceChannel = guild?.channels.get(config.targetChannelId);
            if (voiceChannel) {
                await voiceChannel.edit({ name: 'Member-Count: Error' });
            }
        } catch (e) {
            console.error('❌ Failed to update channel with error message:', e.message);
        }
    }
}

// Bot event handlers
bot.on('ready', async () => {
    console.log(`🤖 ${bot.user.username} is online and ready!`);
    console.log(`📊 Serving ${bot.guilds.size} guilds`);
    
    // Initial member count update
    await updateMemberCount();
    
    // Set up interval for member count updates (every 50 seconds)
    setInterval(updateMemberCount, 10000 * 1000);
    
    // Set bot status
    bot.editStatus('idle', {
        name: `goktug pampa on top`,
        type: 0
    });
});

bot.on('messageCreate', async (msg) => {
    // Ignore if no content, doesn't start with prefix, or is from a bot
    if (!msg.content || !msg.content.startsWith(config.prefix) || msg.author.bot) return;
    
    // Check if user is authorized
    if (!config.authorizedUsers.includes(msg.author.id)) {
        const userLang = getUserLanguage(msg.author.id);
        await msg.channel.createMessage(getMessage(userLang, 'unauthorized'));
        return;
    }
    
    // Parse command and arguments
    const args = msg.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const userLang = getUserLanguage(msg.author.id);
    
    // Check if command exists
    const command = commands[commandName];
    if (!command) {
        const suggestion = suggestCommand(commandName);
        if (suggestion) {
            await msg.channel.createMessage(getMessage(userLang, 'invalidCommand', { 
                command: commandName, 
                suggestion: `${config.prefix}${suggestion}` 
            }));
        } else {
            const commandList = Object.keys(commands).map(c => `\`${config.prefix}${c}\``).join(', ');
            await msg.channel.createMessage(getMessage(userLang, 'commandList', { 
                command: commandName, 
                commands: commandList 
            }));
        }
        return;
    }
    
    // Execute command
    try {
        await command.execute(msg, args, userLang);
        console.log(`✅ Command executed: ${commandName} by ${msg.author.username}`);
    } catch (error) {
        console.error(`❌ Command error: ${commandName}`, error);
        await msg.channel.createMessage(getMessage(userLang, 'error', { error: error.message }));
    }
});

bot.on('guildCreate', (guild) => {
    console.log(`✅ Joined new guild: ${guild.name} (${guild.id})`);
    bot.editStatus('online', {
        name: `${config.prefix}help | ${bot.guilds.size} servers`,
        type: 0
    });
});

bot.on('guildDelete', (guild) => {
    console.log(`❌ Left guild: ${guild.name} (${guild.id})`);
    bot.editStatus('online', {
        name: `${config.prefix}help | ${bot.guilds.size} servers`,
        type: 0
    });
});

bot.on('error', (error) => {
    console.error('❌ Bot error:', error);
});

bot.on('disconnect', () => {
    console.log('🔌 Bot disconnected');
});

bot.on('reconnecting', () => {
    console.log('🔄 Bot reconnecting...');
});

// Process error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Express server for health checks
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        uptime: Date.now() - startTime,
        guilds: bot.guilds.size,
        users: bot.users.size,
        commands: Object.keys(commands).length
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const serverPort = process.env.PORT || 3000;
app.listen(serverPort, () => {
    console.log(`🌐 Express server running on port ${serverPort}`);
});

// Connect bot
bot.connect().catch(console.error);

// Export for testing
module.exports = { bot, commands, config };
