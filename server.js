const express = require('express')
const app = express();
const port = 3000;
const Eris = require('eris');
const axios = require('axios');
require('dotenv').config();

// Eris istemcisini başlat
const bot = new Eris(process.env.DISCORD_BOT_TOKEN, {
    restMode: true,
    intents: ['guilds', 'guildMessages', 'messageContent']
});
const prefix = 'n!';

// Yetkili kullanıcı ID'leri
const authorizedUsers = [
    '834351934495260673',
    '558664937061482516'
];

// Geçerli komutlar
const validCommands = ['announce', 'ping', 'uptime'];

// Botun başlama zamanı (uptime için)
const startTime = Date.now();

// Roblox API URL
const robloxApiUrl = 'https://groups.roblox.com/v1/groups/36047451';

// Belirtilen kanal ID
const targetChannelId = '1378173296973189160'; // Buraya kanal ID'sini girin

// Levenshtein mesafesi (komut önerisi için)
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

// En yakın komutu öner
function suggestCommand(input) {
    const threshold = 3;
    let closest = validCommands[0];
    let minDistance = levenshteinDistance(input, closest);
    for (const cmd of validCommands) {
        const distance = levenshteinDistance(input, cmd);
        if (distance < minDistance) {
            minDistance = distance;
            closest = cmd;
        }
    }
    return minDistance <= threshold ? closest : null;
}

// Bot hazır olduğunda
bot.on('ready', async () => {
    console.log('Bot aktif! Discord’a bağlandı.');

    try {
        // Sunucuları al (örneğin ilk sunucuyu kullanıyoruz)
        const guild = bot.guilds.values().next().value;
        if (!guild) {
            console.error('Hiçbir sunucuya bağlı değil!');
            return;
        }

        // Belirtilen kanalı bul
        const voiceChannel = guild.channels.get(targetChannelId);
        if (!voiceChannel || voiceChannel.type !== 2) {
            console.error('Geçersiz kanal ID veya kanal ses kanalı değil!');
            return;
        }

        // Roblox API'den üye sayısını al ve kanal ismini güncelle
        async function updateChannelName() {
            try {
                const response = await axios.get(robloxApiUrl);
                const memberCount = response.data.memberCount || 'N/A';
                await voiceChannel.edit({ name: `Member-Count: ${memberCount}` });
                console.log(`Kanal ismi güncellendi: Member-Count: ${memberCount}`);
            } catch (error) {
                console.error('Roblox API hatası:', error.message);
                await voiceChannel.edit({ name: 'Member-Count: Error' });
            }
        }

        // İlk güncellemeyi yap
        await updateChannelName();

        // Her 50 saniyede bir güncelle
        setInterval(updateChannelName, 1100000 * 1000);
    } catch (error) {
        console.error('Kanal güncelleme hatası:', error.message);
    }
});

// Mesaj alındığında
bot.on('messageCreate', async (msg) => {
    if (!msg.content || !msg.content.startsWith(prefix) || msg.author.bot) return;

    const args = msg.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (!authorizedUsers.includes(msg.author.id)) {
        await msg.channel.createMessage('Bu komutu kullanma yetkiniz yok!');
        return;
    }

    if (!validCommands.includes(command)) {
        const suggestion = suggestCommand(command);
        if (suggestion) {
            await msg.channel.createMessage(`Geçersiz komut: \`${command}\`. Şunu mu kastettiniz: \`${prefix}${suggestion}\`?`);
        } else {
            await msg.channel.createMessage(`Geçersiz komut: \`${command}\`. Geçerli komutlar: ${validCommands.map(c => `\`${prefix}${c}\``).join(', ')}.`);
        }
        return;
    }

    if (command === 'announce') {
        if (args.length < 1) {
            await msg.channel.createMessage('Lütfen bir duyuru mesajı sağlayın! Örnek: `n!announce Merhaba, bu bir duyuru!`');
            return;
        }
        const announcement = args.join(' ');
        try {
            await msg.channel.createMessage(`📢 **Duyuru**: ${announcement}`);
        } catch (error) {
            await msg.channel.createMessage(`Duyuru gönderilirken hata: ${error.message}`);
        }
    }

    if (command === 'ping') {
        const sentMessage = await msg.channel.createMessage('!pong');
        const latency = sentMessage.createdAt - msg.createdAt;
        await sentMessage.edit(`!pong (${latency}ms)`);
    }

    if (command === 'uptime') {
        const uptimeMs = Date.now() - startTime;
        const seconds = Math.floor((uptimeMs / 1000) % 60);
        const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
        const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
        const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));

        const uptimeStr = [
            days ? `${days} gün` : '',
            hours ? `${hours} saat` : '',
            minutes ? `${minutes} dakika` : '',
            seconds ? `${seconds} saniye` : ''
        ].filter(Boolean).join(', ');

        await msg.channel.createMessage(`Uptime: ${uptimeStr || '0 saniye'}`);
    }
});

// Hataları yakala
process.on('unhandledRejection', (error) => console.error('Yakalanmamış hata:', error));
bot.on('error', (error) => console.error('Bağlantı hatası:', error));

// Botu bağla
bot.connect();
