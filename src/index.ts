import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Bot, GrammyError, HttpError, webhookCallback, type Context } from "grammy";
import { config } from "./config.js";
import { handleContest } from "./handlers/contest.js";
import { handleHelp } from "./handlers/help.js";
import { handleLeaderboard } from "./handlers/leaderboard.js";
import { handleReferral } from "./handlers/referral.js";
import { handleHome, handleStart } from "./handlers/start.js";
import { handleStats } from "./handlers/stats.js";
import { handleVerify } from "./handlers/verify.js";
import { CALLBACK } from "./keyboards/main.js";
import { LovableApiError } from "./services/lovableApi.js";
import { TelegramServiceError, answerCallback, editOrReply } from "./services/telegram.js";
import { SERVICE_UNAVAILABLE_TEXT, TELEGRAM_UNAVAILABLE_TEXT } from "./utils/formatting.js";
import { logger } from "./utils/logger.js";

const bot = new Bot(config.telegramBotToken);

function wrap(handler: (ctx: Context) => Promise<void>) {
  return async (ctx: Context): Promise<void> => {
    await answerCallback(ctx);
    try {
      await handler(ctx);
    } catch (error) {
      if (error instanceof LovableApiError) {
        if (error.code === "invalid_request") {
          logger.warn("Skipped request with invalid Telegram ID");
          return;
        }
        await editOrReply(ctx, SERVICE_UNAVAILABLE_TEXT);
        return;
      }
      if (error instanceof TelegramServiceError) {
        await editOrReply(ctx, TELEGRAM_UNAVAILABLE_TEXT);
        return;
      }
      throw error;
    }
  };
}

bot.use(async (ctx, next) => {
  if (ctx.chat && ctx.chat.type !== "private") {
    if (ctx.message?.text?.startsWith("/")) {
      await ctx.reply("Please open a private chat with the bot to join the Eddy Calls referral contest.");
    }
    return;
  }
  await next();
});

bot.command("start", wrap(handleStart));
bot.command("referral", wrap(handleReferral));
bot.command("stats", wrap(handleStats));
bot.command("leaderboard", wrap(handleLeaderboard));
bot.command("contest", wrap(handleContest));
bot.command("help", wrap(handleHelp));

bot.callbackQuery(CALLBACK.home, wrap(handleHome));
bot.callbackQuery(CALLBACK.verify, wrap(handleVerify));
bot.callbackQuery(CALLBACK.referral, wrap(handleReferral));
bot.callbackQuery(CALLBACK.stats, wrap(handleStats));
bot.callbackQuery(CALLBACK.leaderboard, wrap(handleLeaderboard));

bot.catch((error) => {
  const err = error.error;
  logger.error("Unhandled bot error", err);

  if (err instanceof GrammyError || err instanceof HttpError) {
    void error.ctx.reply(TELEGRAM_UNAVAILABLE_TEXT).catch(() => undefined);
    return;
  }

  void error.ctx.reply(SERVICE_UNAVAILABLE_TEXT).catch(() => undefined);
});

async function configureBotMenu(): Promise<void> {
  await bot.api.setMyCommands([
    { command: "start", description: "Contest home" },
    { command: "referral", description: "Get your referral link" },
    { command: "stats", description: "View your stats" },
    { command: "leaderboard", description: "View top referrers" },
    { command: "contest", description: "Contest information" },
    { command: "help", description: "Help" },
  ]);
}

function isHealthRequest(req: IncomingMessage): boolean {
  return req.method === "GET" && (req.url === "/" || req.url === "/health");
}

async function startWebhook(): Promise<void> {
  const port = config.port ?? 3000;
  const webhookUrl = config.webhookUrl;
  if (!webhookUrl) {
    throw new Error("WEBHOOK_URL is required for webhook mode");
  }

  const handleUpdate = config.webhookSecret
    ? webhookCallback(bot, "http", { secretToken: config.webhookSecret })
    : webhookCallback(bot, "http");

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (isHealthRequest(req)) {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }

    try {
      await handleUpdate(req, res);
    } catch (error) {
      logger.error("Webhook request failed", error);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end();
      }
    }
  });

  await bot.api.setWebhook(webhookUrl, {
    ...(config.webhookSecret ? { secret_token: config.webhookSecret } : {}),
    drop_pending_updates: false,
  });

  await new Promise<void>((resolve) => {
    server.listen(port, () => resolve());
  });

  logger.info(`Eddy Calls bot listening for webhooks on port ${port}`);
}

async function startPolling(): Promise<void> {
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  logger.info("Eddy Calls referral bot started (long polling)");
  await bot.start({
    onStart: () => {
      logger.info("Telegram long polling is active");
    },
  });
}

async function main(): Promise<void> {
  await configureBotMenu();

  process.once("SIGINT", () => {
    void bot.stop();
  });
  process.once("SIGTERM", () => {
    void bot.stop();
  });

  if (config.webhookUrl) {
    await startWebhook();
    return;
  }

  await startPolling();
}

main().catch((error: unknown) => {
  logger.error("Fatal startup error", error);
  process.exit(1);
});
