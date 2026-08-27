import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Bot, GrammyError, HttpError, webhookCallback, type Context } from "grammy";
import { config } from "./config.js";
import { handleHelp } from "./handlers/help.js";
import { handleHome, handleStart } from "./handlers/start.js";
import { handleStatus } from "./handlers/status.js";
import {
  handleInvite,
  handlePlan,
  handlePreCheckout,
  handleSubscribe,
  handleSuccessfulPayment,
} from "./handlers/subscribe.js";
import { CALLBACK } from "./keyboards/main.js";
import { revokeChannelAccess } from "./services/access.js";
import { answerCallback, editOrReply } from "./services/telegram.js";
import { expireDue } from "./store/subscriptions.js";
import { SERVICE_UNAVAILABLE_TEXT, TELEGRAM_UNAVAILABLE_TEXT } from "./utils/formatting.js";
import { logger } from "./utils/logger.js";

const bot = new Bot(config.telegramBotToken);
const EXPIRY_POLL_MS = 60_000;

function wrap(handler: (ctx: Context) => Promise<void>) {
  return async (ctx: Context): Promise<void> => {
    await answerCallback(ctx);
    try {
      await handler(ctx);
    } catch (error) {
      logger.error("Handler failed", error);
      await editOrReply(ctx, SERVICE_UNAVAILABLE_TEXT);
    }
  };
}

bot.use(async (ctx, next) => {
  if (ctx.preCheckoutQuery || ctx.message?.successful_payment) {
    await next();
    return;
  }

  if (ctx.chat && ctx.chat.type !== "private") {
    if (ctx.message?.text?.startsWith("/")) {
      await ctx.reply("Please open a private chat with the bot to subscribe.");
    }
    return;
  }
  await next();
});

bot.command("start", wrap(handleStart));
bot.command("subscribe", wrap(handleSubscribe));
bot.command("status", wrap(handleStatus));
bot.command("help", wrap(handleHelp));

bot.callbackQuery(CALLBACK.home, wrap(handleHome));
bot.callbackQuery(CALLBACK.subscribe, wrap(handleSubscribe));
bot.callbackQuery(CALLBACK.status, wrap(handleStatus));
bot.callbackQuery(CALLBACK.invite, wrap(handleInvite));
bot.callbackQuery(CALLBACK.help, wrap(handleHelp));
bot.callbackQuery(CALLBACK.weekly, wrap((ctx) => handlePlan(ctx, "weekly")));
bot.callbackQuery(CALLBACK.monthly, wrap((ctx) => handlePlan(ctx, "monthly")));

bot.on("pre_checkout_query", async (ctx) => {
  try {
    await handlePreCheckout(ctx);
  } catch (error) {
    logger.error("Pre-checkout failed", error);
    await ctx.answerPreCheckoutQuery(false, {
      error_message: "Payment could not be confirmed. Please try again.",
    });
  }
});

bot.on("message:successful_payment", async (ctx) => {
  try {
    await handleSuccessfulPayment(ctx);
  } catch (error) {
    logger.error("Successful payment handler failed", error);
    await ctx.reply(SERVICE_UNAVAILABLE_TEXT);
  }
});

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
    { command: "start", description: "Home" },
    { command: "subscribe", description: "Choose a subscription plan" },
    { command: "status", description: "Check your subscription" },
    { command: "help", description: "Help" },
  ]);
}

function isHealthRequest(req: IncomingMessage): boolean {
  return req.method === "GET" && (req.url === "/" || req.url === "/health");
}

async function sweepExpiredSubscriptions(): Promise<void> {
  const expired = await expireDue();
  for (const subscription of expired) {
    const userId = Number(subscription.telegramId);
    if (!Number.isSafeInteger(userId)) {
      continue;
    }
    await revokeChannelAccess(bot.api, userId);
    try {
      await bot.api.sendMessage(
        userId,
        "Your channel subscription has expired. Open the bot and subscribe again to rejoin.",
      );
    } catch {
      // User may have blocked the bot.
    }
  }
  if (expired.length > 0) {
    logger.info(`Expired ${expired.length} subscription${expired.length === 1 ? "" : "s"}`);
  }
}

function startExpirySweeper(): void {
  void sweepExpiredSubscriptions();
  setInterval(() => {
    void sweepExpiredSubscriptions();
  }, EXPIRY_POLL_MS);
}

async function listenHttp(): Promise<void> {
  const port = config.port ?? 3000;
  const webhookUrl = config.webhookUrl;

  const handleUpdate = webhookUrl
    ? config.webhookSecret
      ? webhookCallback(bot, "http", { secretToken: config.webhookSecret })
      : webhookCallback(bot, "http")
    : null;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (isHealthRequest(req)) {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }

    if (!handleUpdate) {
      res.writeHead(404);
      res.end();
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

  await new Promise<void>((resolve) => {
    server.listen(port, () => resolve());
  });

  if (webhookUrl) {
    await bot.api.setWebhook(webhookUrl, {
      ...(config.webhookSecret ? { secret_token: config.webhookSecret } : {}),
      drop_pending_updates: false,
    });
    logger.info(`Subscription bot listening for webhooks on port ${port}`);
    return;
  }

  logger.info(`Health server listening on port ${port}`);
}

async function startPolling(): Promise<void> {
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  logger.info("Subscription bot started (long polling)");
  await bot.start({
    onStart: () => {
      logger.info("Telegram long polling is active");
    },
  });
}

async function main(): Promise<void> {
  await configureBotMenu();
  startExpirySweeper();

  process.once("SIGINT", () => {
    void bot.stop();
  });
  process.once("SIGTERM", () => {
    void bot.stop();
  });

  await listenHttp();

  if (config.webhookUrl) {
    return;
  }

  await startPolling();
}

main().catch((error: unknown) => {
  logger.error("Fatal startup error", error);
  process.exit(1);
});
