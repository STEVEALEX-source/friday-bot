import { Router } from "express";

const router = Router();

const moodStats = {
  great: 0,
  okay: 0,
  rough: 0,
  updated: new Date().toISOString(),
};

router.get("/status", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.post("/send-message", async (req, res) => {
  const { channelId, text, blocks } = req.body;

  if (!channelId || !text) {
    return res.status(400).json({ error: "channelId and text are required" });
  }

  try {
    await req.slack.chat.postMessage({
      channel: channelId,
      text,
      blocks: blocks || undefined,
    });

    res.json({
      success: true,
      message: "Message queued for sending",
      channelId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to send message" });
  }
});

router.post("/broadcast", async (req, res) => {
  const { text, blocks } = req.body;

  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }

  const subscribedChannels = process.env.BROADCAST_CHANNELS
    ? process.env.BROADCAST_CHANNELS.split(",").map((c) => c.trim())
    : [];

  if (subscribedChannels.length === 0) {
    return res.status(400).json({
      error: "No subscribed channels configured. Set BROADCAST_CHANNELS in .env",
    });
  }

  const broadcastId = `bc-${Date.now()}`;

  try {
    await Promise.all(
      subscribedChannels.map((channelId) =>
        req.slack.chat.postMessage({
          channel: channelId,
          text,
          blocks: blocks || undefined,
        })
      )
    );

    res.json({
      success: true,
      message: "Broadcast queued",
      broadcastId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to broadcast" });
  }
});

router.post("/schedule-message", (req, res) => {
  const { channelId, text, delaySeconds } = req.body;

  if (!channelId || !text || delaySeconds == null) {
    return res.status(400).json({ error: "channelId, text and delaySeconds are required" });
  }

  const delayMs = Number(delaySeconds) * 1000;
  if (isNaN(delayMs) || delayMs < 0) {
    return res.status(400).json({ error: "delaySeconds must be a non-negative number" });
  }

  const scheduledFor = new Date(Date.now() + delayMs).toISOString();

  setTimeout(async () => {
    try {
      await req.slack.chat.postMessage({
        channel: channelId,
        text,
      });
    } catch (err) {
      console.error(err);
    }
  }, delayMs);

  res.json({
    success: true,
    message: "Message scheduled",
    scheduledFor,
    channelId,
  });
});

router.post("/trigger-mood-check", async (req, res) => {
  const { channelId } = req.body;

  if (!channelId) {
    return res.status(400).json({ error: "channelId is required" });
  }

  try {
    await req.slack.chat.postMessage({
      channel: channelId,
      text: "How is everyone feeling today?",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Mood Check*\nHow are you feeling right now?",
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Great" },
              action_id: "mood_great",
              value: "great",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Okay" },
              action_id: "mood_okay",
              value: "okay",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Rough" },
              action_id: "mood_rough",
              value: "rough",
            },
          ],
        },
      ],
    });

    res.json({
      success: true,
      message: "Mood check initiated",
      channelId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to trigger mood check" });
  }
});

router.get("/moods", (_req, res) => {
  res.json({
    ...moodStats,
    updated: new Date().toISOString(),
  });
});

export default router;