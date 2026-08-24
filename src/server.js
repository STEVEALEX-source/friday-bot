import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { App } from "@slack/bolt";
import apiRoutes from "./routes/api.js";

const {
  SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET,
  SLACK_APP_TOKEN,
  API_KEY,
  PORT = 3000,
} = process.env;

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET || !SLACK_APP_TOKEN || !API_KEY) {
  console.error("Missing required environment variables. Check your .env file.");
  process.exit(1);
}

const slackApp = new App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: SLACK_APP_TOKEN,
});

// --- Catch All Bolt Errors ---
slackApp.error(async (error) => {
  console.error("SLACK BOLT GLOBAL ERROR:", error);
});

// --- Slack Bot Commands ---

// ORIGINAL COMMANDS

slackApp.command('/bot-status', async ({ command, ack, respond }) => {
  console.log("--> /bot-status received");
  await ack();
  try {
    const uptimeMinutes = Math.floor(process.uptime() / 60);
    await respond(`System Status: Operational. Uptime: ${uptimeMinutes} minutes.`);
  } catch (error) {
    console.error("Error in /bot-status:", error);
  }
});

slackApp.command('/bot-echo', async ({ command, ack, respond }) => {
  console.log("--> /bot-echo received");
  await ack();
  try {
    const text = command.text && command.text.trim() !== "" ? command.text : "No text provided.";
    await respond(`Echo: ${text}`);
  } catch (error) {
    console.error("Error in /bot-echo:", error);
  }
});

slackApp.command('/bot-calc', async ({ command, ack, respond }) => {
  console.log("--> /bot-calc received with text:", command.text);
  await ack();
  try {
    const text = command.text ? command.text.trim() : "";
    const expression = text.replace(/[^0-9+\-*/().]/g, '');
    
    if (!expression) {
      await respond("Please provide a valid math expression. Example: /bot-calc 5 + 5");
      return;
    }
    
    const result = Function(`'use strict'; return (${expression})`)();
    await respond(`Result: ${expression} = ${result}`);
  } catch (error) {
    console.error("Error in /bot-calc:", error);
    await respond("Invalid calculation format. Please check your expression.");
  }
});

slackApp.command('/bot-user', async ({ command, ack, respond }) => {
  console.log("--> /bot-user received");
  await ack();
  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/users/1');
    if (!response.ok) throw new Error("API request failed");
    
    const user = await response.json();
    await respond(`Random User Profile:\n- Name: ${user.name}\n- Email: ${user.email}\n- Company: ${user.company.name}`);
  } catch (error) {
    console.error("Error in /bot-user:", error);
    await respond("Failed to fetch user data from external API.");
  }
});

// --- UTILITY COMMANDS ---

slackApp.command('/bot-weather', async ({ command, ack, respond }) => {
  console.log("--> /bot-weather received");
  await ack();
  try {
    const city = command.text?.trim() || "London";
    const response = await fetch(`https://wttr.in/${city}?format=j1`);
    if (!response.ok) throw new Error("Weather API failed");
    
    const data = await response.json();
    const current = data.current_condition[0];
    const condition = current.weatherDesc[0].value;
    const temp = current.temp_C;
    const humidity = current.humidity;
    
    await respond(`Weather in ${city}:\nTemperature: ${temp}°C\nCondition: ${condition}\nHumidity: ${humidity}%`);
  } catch (error) {
    console.error("Error in /bot-weather:", error);
    await respond("Failed to fetch weather data. Try: /bot-weather London");
  }
});

slackApp.command('/bot-remind', async ({ command, ack, respond }) => {
  console.log("--> /bot-remind received");
  await ack();
  try {
    const text = command.text?.trim() || "No reminder text provided";
    const reminderTime = new Date(Date.now() + 60000).toLocaleTimeString();
    await respond(`Reminder set for ~${reminderTime}: "${text}"`);
  } catch (error) {
    console.error("Error in /bot-remind:", error);
    await respond("Failed to set reminder.");
  }
});

slackApp.command('/bot-translate', async ({ command, ack, respond }) => {
  console.log("--> /bot-translate received");
  await ack();
  try {
    const input = command.text?.trim() || "";
    if (!input.includes(":")) {
      await respond("Usage: /bot-translate text:language\nExample: /bot-translate Hello:es");
      return;
    }
    
    const [text, lang] = input.split(":");
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang.trim()}`);
    const data = await response.json();
    
    if (data.responseStatus === 200) {
      await respond(`Translation (${lang.trim()}):\n"${data.responseData.translatedText}"`);
    } else {
      await respond("Translation failed. Supported: es, fr, de, it, pt, ru, ja, zh...");
    }
  } catch (error) {
    console.error("Error in /bot-translate:", error);
    await respond("Failed to translate. Usage: /bot-translate hello:es");
  }
});

slackApp.command('/bot-qrcode', async ({ command, ack, respond }) => {
  console.log("--> /bot-qrcode received");
  await ack();
  try {
    const text = command.text?.trim() || "https://example.com";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
    await respond({
      text: `QR Code for: ${text}`,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `*QR Code for:*\n\`${text}\`` }
        },
        {
          type: "image",
          image_url: qrUrl,
          alt_text: "Generated QR Code"
        }
      ]
    });
  } catch (error) {
    console.error("Error in /bot-qrcode:", error);
    await respond("Failed to generate QR code.");
  }
});

// --- DEVELOPER COMMANDS ---

slackApp.command('/bot-git-status', async ({ command, ack, respond }) => {
  console.log("--> /bot-git-status received");
  await ack();
  try {
    const repo = command.text?.trim() || "facebook/react";
    const response = await fetch(`https://api.github.com/repos/${repo}`);
    if (!response.ok) throw new Error("GitHub API failed");
    
    const data = await response.json();
    await respond(
      `Git Repo: ${data.name}\n` +
      `Stars: ${data.stargazers_count}\n` +
      `Forks: ${data.forks_count}\n` +
      `Watchers: ${data.watchers_count}\n` +
      `Language: ${data.language || "N/A"}`
    );
  } catch (error) {
    console.error("Error in /bot-git-status:", error);
    await respond("Failed to fetch repo. Usage: /bot-git-status username/repo");
  }
});

slackApp.command('/bot-snippet', async ({ command, ack, respond }) => {
  console.log("--> /bot-snippet received");
  await ack();
  try {
    const lang = command.text?.trim() || "javascript";
    const snippets = {
      javascript: "const hello = () => console.log('Hello World');",
      python: "def hello():\n    print('Hello World')",
      rust: "fn main() { println!(\"Hello World\"); }",
      go: "package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"Hello World\") }",
      java: "public class Main { public static void main(String[] args) { System.out.println(\"Hello World\"); } }"
    };
    
    const snippet = snippets[lang] || snippets.javascript;
    await respond(`\`\`\`${lang}\n${snippet}\n\`\`\``);
  } catch (error) {
    console.error("Error in /bot-snippet:", error);
    await respond("Snippet generated. Supported: javascript, python, rust, go, java");
  }
});

slackApp.command('/bot-deploy', async ({ command, ack, respond }) => {
  console.log("--> /bot-deploy received");
  await ack();
  try {
    const service = command.text?.trim() || "api";
    const deployId = Math.random().toString(36).substring(7).toUpperCase();
    const statuses = ["✅ Success", "🟡 In Progress", "❌ Failed"];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    await respond(
      `Deployment Started\n` +
      `Service: ${service}\n` +
      `Deploy ID: ${deployId}\n` +
      `Status: ${randomStatus}`
    );
  } catch (error) {
    console.error("Error in /bot-deploy:", error);
    await respond("Failed to initiate deployment.");
  }
});

slackApp.command('/bot-logs', async ({ command, ack, respond }) => {
  console.log("--> /bot-logs received");
  await ack();
  try {
    const lines = command.text ? parseInt(command.text) : 5;
    const logEntries = Array.from({ length: Math.min(lines, 10) }, (_, i) => {
      const timestamps = ['10:23:45', '10:24:12', '10:24:58', '10:25:33', '10:26:01'];
      return `[${timestamps[i % timestamps.length]}] INFO: Process running normally`;
    });
    
    await respond("```\n" + logEntries.join("\n") + "\n```");
  } catch (error) {
    console.error("Error in /bot-logs:", error);
    await respond("Failed to fetch logs.");
  }
});

// --- FUN & SOCIAL COMMANDS ---

slackApp.command('/bot-joke', async ({ command, ack, respond }) => {
  console.log("--> /bot-joke received");
  await ack();
  try {
    const response = await fetch('https://official-joke-api.appspot.com/random_joke');
    const data = await response.json();
    await respond(`Joke:\n${data.setup}\n_${data.punchline}_`);
  } catch (error) {
    console.error("Error in /bot-joke:", error);
    await respond("Why did the bot cross the road? To debug the other side! 😄");
  }
});

slackApp.command('/bot-quote', async ({ command, ack, respond }) => {
  console.log("--> /bot-quote received");
  await ack();
  try {
    const response = await fetch('https://api.quotable.io/random');
    const data = await response.json();
    await respond(`"${data.content}"\n— ${data.author}`);
  } catch (error) {
    console.error("Error in /bot-quote:", error);
    await respond('"The only way to do great work is to love what you do." — Steve Jobs');
  }
});

slackApp.command('/bot-dice', async ({ command, ack, respond }) => {
  console.log("--> /bot-dice received");
  await ack();
  try {
    const sides = parseInt(command.text?.trim()) || 6;
    const roll = Math.floor(Math.random() * sides) + 1;
    
    await respond(`Rolled d${sides}: **${roll}**`);
  } catch (error) {
    console.error("Error in /bot-dice:", error);
    await respond("Failed to roll dice.");
  }
});

slackApp.command('/bot-poll', async ({ command, ack, respond }) => {
  console.log("--> /bot-poll received");
  await ack();
  try {
    const question = command.text?.trim() || "Do you like this bot?";
    const pollId = Math.random().toString(36).substring(7);
    
    await respond({
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `*Poll:* ${question}` } },
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "👍 Yes" }, value: `yes_${pollId}` },
            { type: "button", text: { type: "plain_text", text: "👎 No" }, value: `no_${pollId}` },
            { type: "button", text: { type: "plain_text", text: "🤷 Maybe" }, value: `maybe_${pollId}` }
          ]
        }
      ]
    });
  } catch (error) {
    console.error("Error in /bot-poll:", error);
    await respond("Failed to create poll.");
  }
});

// --- INFO COMMANDS ---

slackApp.command('/bot-time', async ({ command, ack, respond }) => {
  console.log("--> /bot-time received");
  await ack();
  try {
    const timezone = command.text?.trim() || "UTC";
    const now = new Date().toLocaleString('en-US', { timeZone: timezone });
    await respond(`🕐 Current time in ${timezone}:\n${now}`);
  } catch (error) {
    console.error("Error in /bot-time:", error);
    await respond(`Current UTC time: ${new Date().toISOString()}`);
  }
});

slackApp.command('/bot-crypto', async ({ command, ack, respond }) => {
  console.log("--> /bot-crypto received");
  await ack();
  try {
    const coin = command.text?.trim().toUpperCase() || "BTC";
    const response = await fetch(`https://api.coincap.io/v2/assets/${coin.toLowerCase()}`);
    
    if (!response.ok) {
      await respond(`Coin not found. Try: BTC, ETH, ADA, XRP`);
      return;
    }
    
    const data = await response.json();
    const price = parseFloat(data.data.priceUsd).toFixed(2);
    const change = parseFloat(data.data.changePercent24Hr).toFixed(2);
    const arrow = change >= 0 ? "Up" : "Down";
    
    await respond(`${coin}: $${price}\n${arrow} 24h Change: ${change}%`);
  } catch (error) {
    console.error("Error in /bot-crypto:", error);
    await respond("Failed to fetch crypto data.");
  }
});

slackApp.command('/bot-news', async ({ command, ack, respond }) => {
  console.log("--> /bot-news received");
  await ack();
  try {
    const response = await fetch('https://newsapi.org/v2/top-headlines?country=us&pageSize=3');
    
    if (!response.ok) {
      await respond("News API unavailable. Add NEWSAPI_KEY to .env");
      return;
    }
    
    const data = await response.json();
    const headlines = data.articles.slice(0, 3).map((article, i) => 
      `${i + 1}. *${article.title}*\n${article.url}`
    ).join("\n\n");
    
    await respond(headlines || "No headlines available");
  } catch (error) {
    console.error("Error in /bot-news:", error);
    await respond("Failed to fetch news. Visit: newsapi.org");
  }
});

slackApp.command('/bot-xkcd', async ({ command, ack, respond }) => {
  console.log("--> /bot-xkcd received");
  await ack();
  try {
    const response = await fetch('https://xkcd.com/info.0.json');
    const data = await response.json();
    const comicNum = Math.floor(Math.random() * data.num) + 1;
    
    const comicResponse = await fetch(`https://xkcd.com/${comicNum}/info.0.json`);
    const comic = await comicResponse.json();
    
    await respond({
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `*XKCD #${comic.num}*\n${comic.title}` } },
        {
          type: "image",
          image_url: comic.img,
          alt_text: comic.alt
        }
      ]
    });
  } catch (error) {
    console.error("Error in /bot-xkcd:", error);
    await respond("Failed to fetch XKCD comic.");
  }
});

// --- GAMING COMMANDS ---

slackApp.command('/bot-game-search', async ({ command, ack, respond }) => {
  console.log("--> /bot-game-search received");
  await ack();
  try {
    const game = command.text?.trim() || "Elden Ring";
    const response = await fetch(`https://www.rawg.io/api/games?search=${encodeURIComponent(game)}&page_size=1`);
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      await respond("Game not found.");
      return;
    }
    
    const g = data.results[0];
    await respond(
      `${g.name}\n` +
      `Rating: ${g.rating}/5\n` +
      `Released: ${g.released || "N/A"}\n` +
      `Platforms: ${g.platforms?.slice(0, 3).map(p => p.platform.name).join(", ") || "N/A"}`
    );
  } catch (error) {
    console.error("Error in /bot-game-search:", error);
    await respond("Failed to search games.");
  }
});

slackApp.command('/bot-stream-status', async ({ command, ack, respond }) => {
  console.log("--> /bot-stream-status received");
  await ack();
  try {
    const streamer = command.text?.trim() || "example";
    const statuses = ["LIVE", "Offline", "Starting Soon"];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const viewers = Math.floor(Math.random() * 50000) + 100;
    
    await respond(`${randomStatus}\n${streamer}\nViewers: ${viewers}`);
  } catch (error) {
    console.error("Error in /bot-stream-status:", error);
    await respond("Failed to check stream status.");
  }
});

slackApp.command('/bot-leaderboard', async ({ command, ack, respond }) => {
  console.log("--> /bot-leaderboard received");
  await ack();
  try {
    const game = command.text?.trim() || "general";
    const leaderboard = [
      "1. Player1 - 9,850 points",
      "2. Player2 - 8,720 points",
      "3. Player3 - 7,590 points",
      "4. Player4 - 6,440 points",
      "5. Player5 - 5,310 points"
    ].join("\n");
    
    await respond(`*Leaderboard: ${game}*\n${leaderboard}`);
  } catch (error) {
    console.error("Error in /bot-leaderboard:", error);
    await respond("Failed to fetch leaderboard.");
  }
});

// --- MESSAGE LISTENER ---

slackApp.message('info', async ({ message, say }) => {
  console.log("--> 'info' message received");
  try {
    await say(
      `*Available Commands:*\n\n` +
      `*Original:* /bot-status, /bot-echo, /bot-calc, /bot-user\n\n` +
      `*Utility:* /bot-weather [city], /bot-remind [text], /bot-translate [text:lang], /bot-qrcode [text]\n\n` +
      `*Developer:* /bot-git-status [user/repo], /bot-snippet [lang], /bot-deploy [service], /bot-logs [lines]\n\n` +
      `*Fun:* /bot-joke, /bot-quote, /bot-dice [sides], /bot-poll [question]\n\n` +
      `*Info:* /bot-time [timezone], /bot-crypto [coin], /bot-news, /bot-xkcd\n\n` +
      `*Gaming:* /bot-game-search [name], /bot-stream-status [streamer], /bot-leaderboard [game]`
    );
  } catch (error) {
    console.error("Error in message listener:", error);
  }
});

// --- Express App Setup ---

const expressApp = express();

expressApp.use(cors());
expressApp.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
expressApp.use("/api", limiter);

expressApp.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

function requireApiKey(req, res, next) {
  const key = req.header("X-API-Key");
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

expressApp.use((req, _res, next) => {
  req.slack = slackApp.client;
  next();
});

expressApp.use("/api", requireApiKey, apiRoutes);

(async () => {
  await slackApp.start();
  console.log("Slack bot connected via Socket Mode");

  expressApp.listen(PORT, () => {
    console.log(`REST API listening on port ${PORT}`);
  });
})();
