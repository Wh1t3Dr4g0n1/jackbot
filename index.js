require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const { WebcastPushConnection } = require("tiktok-live-connector");
const cron = require("node-cron");
const fs = require("fs");

// =======================
// BOT DISCORD
// =======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// =======================
// VARIÁVEIS
// =======================
let liveOnline = false;
const TIKTOK_URL = `https://www.tiktok.com/@${process.env.TIKTOK_USER}`;

// =======================
// BOT ONLINE
// =======================
client.once("ready", () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);

  checkLive();

  // verifica vídeo novo a cada 5 minutos
  cron.schedule("* * * * *", checkTikTok);
});

// =======================
// VERIFICAR LIVE
// =======================
function checkLive() {
  const tiktokLive = new WebcastPushConnection(process.env.TIKTOK_USER);

  tiktokLive.connect()
    .then(() => {
      if (!liveOnline) {
        liveOnline = true;

        const channel = client.channels.cache.get(
          process.env.CHANNEL_LIVE_ID
        );

        if (channel) {
          channel.send(
            `🔴 **${process.env.TIKTOK_USER} está AO VIVO no TikTok!**\n` +
            `👉 https://www.tiktok.com/@${process.env.TIKTOK_USER}`
          );
        }
      }
    })
    .catch(() => {
      liveOnline = false;
    });

  // rechecagem a cada 30 segundos
  setTimeout(checkLive, 1000 * 30);
}

// =======================
// PEGAR ÚLTIMO VÍDEO
// =======================
async function getLastVideoId() {
  const { data } = await axios.get(TIKTOK_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9"
    }
  });

  console.log("HTML recebido:", data.length);

  const $ = cheerio.load(data);
  const script = $('script[id="SIGI_STATE"]').html();

  if (!script) {
    console.log("❌ SIGI_STATE NÃO encontrado — TikTok bloqueou");
    return null;
  }

  console.log("✅ SIGI_STATE encontrado");

  const json = JSON.parse(script);
  const items = json.ItemModule;
  const ids = Object.keys(items);

  console.log("Último vídeo:", ids[0]);

  return ids[0];
}

// =======================
// VERIFICAR NOVO VÍDEO
// =======================
async function checkTikTok() {
  try {
    const feedUrl = `https://rsshub.app/tiktok/user/${process.env.TIKTOK_USER}`;
    const { data } = await axios.get(feedUrl, {
      timeout: 15000
    });

    // pega o primeiro link de vídeo do feed
    const match = data.match(
      /<link>(https:\/\/www\.tiktok\.com\/@.*?\/video\/\d+)<\/link>/
    );

    if (!match) {
      console.log("⚠️ Nenhum vídeo encontrado no RSS");
      return;
    }

    const videoUrl = match[1];
    const videoId = videoUrl.split("/video/")[1];

    const file = "lastVideo.json";
    const saved = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file))
      : {};

    if (saved.id !== videoId) {
      fs.writeFileSync(file, JSON.stringify({ id: videoId }));

      const channel = await client.channels.fetch(
        process.env.CHANNEL_ID
      );

      await channel.send(
        `📢 **Novo vídeo no TikTok!**\n${videoUrl}`
      );

      console.log("✅ Novo vídeo enviado:", videoUrl);
    }
  } catch (err) {
    console.log("❌ Erro RSSHub:", err.message);
  }
}

// =======================
// LOGIN
// =======================
client.login(process.env.DISCORD_TOKEN);
