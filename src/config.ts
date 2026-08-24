import dotenv from "dotenv";

dotenv.config();

const REQUIRED_ENV_VARS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHANNEL_ID",
  "TELEGRAM_CHANNEL_USERNAME",
  "LOVABLE_API_URL",
  "BOT_API_SECRET",
  "TELEGRAM_BOT_USERNAME",
] as const;

function readRequired(name: (typeof REQUIRED_ENV_VARS)[number]): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("LOVABLE_API_URL must be an http or https URL");
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    throw new Error("LOVABLE_API_URL must be a valid URL");
  }
}

function normalizeUsername(value: string): string {
  return value.replace(/^@/, "").trim();
}

function loadConfig() {
  for (const name of REQUIRED_ENV_VARS) {
    readRequired(name);
  }

  const telegramBotUsername = normalizeUsername(readRequired("TELEGRAM_BOT_USERNAME"));
  const telegramChannelUsername = normalizeUsername(readRequired("TELEGRAM_CHANNEL_USERNAME"));
  const channelIdRaw = readRequired("TELEGRAM_CHANNEL_ID");

  return {
    telegramBotToken: readRequired("TELEGRAM_BOT_TOKEN"),
    telegramChannelId: channelIdRaw,
    telegramChannelUsername,
    lovableApiUrl: normalizeUrl(readRequired("LOVABLE_API_URL")),
    botApiSecret: readRequired("BOT_API_SECRET"),
    telegramBotUsername,
    httpTimeoutMs: 10_000,
    nodeEnv: process.env.NODE_ENV?.trim() || "development",
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    webhookUrl: process.env.WEBHOOK_URL?.trim() || undefined,
    webhookSecret: process.env.WEBHOOK_SECRET?.trim() || undefined,
  } as const;
}

export const config = loadConfig();
export type AppConfig = typeof config;
