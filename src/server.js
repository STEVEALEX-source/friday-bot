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
  console.error("🔥 SLACK BOLT GLOBAL ERROR:", error);
});

// --- Slack Bot Commands ---

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

slackApp.message('info', async ({ message, say }) => {
  console.log("--> 'info' message received");
  try {
    await say(`Available commands:\n- /bot-status\n- /bot-echo [text]\n- /bot-calc [expression]\n- /bot-user`);
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