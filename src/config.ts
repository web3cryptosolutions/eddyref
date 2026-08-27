import dotenv from "dotenv";

dotenv.config();

const REQUIRED_ENV_VARS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHANNEL_ID",
  "TELEGRAM_BOT_USERNAME",
] as const;

function readRequired(name: (typeof REQUIRED_ENV_VARS)[number]): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function normalizeUsername(value: string | undefined): string | undefined {
  const normalized = value?.replace(/^@/, "").trim();
  return normalized || undefined;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export const PLAN_IDS = ["weekly", "monthly"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface Plan {
  id: PlanId;
  title: string;
  days: number;
  stars: number;
}

function loadConfig() {
  for (const name of REQUIRED_ENV_VARS) {
    readRequired(name);
  }

  const weekly: Plan = {
    id: "weekly",
    title: "Weekly",
    days: readPositiveInt("WEEKLY_DAYS", 7),
    stars: readPositiveInt("WEEKLY_STARS", 1000),
  };
  const monthly: Plan = {
    id: "monthly",
    title: "Monthly",
    days: readPositiveInt("MONTHLY_DAYS", 30),
    stars: readPositiveInt("MONTHLY_STARS", 2500),
  };

  return {
    telegramBotToken: readRequired("TELEGRAM_BOT_TOKEN"),
    telegramChannelId: readRequired("TELEGRAM_CHANNEL_ID"),
    telegramChannelUsername: normalizeUsername(readOptional("TELEGRAM_CHANNEL_USERNAME")),
    telegramBotUsername: normalizeUsername(readRequired("TELEGRAM_BOT_USERNAME")) ?? "bot",
    channelName: readOptional("CHANNEL_NAME") || "the private channel",
    plans: { weekly, monthly } satisfies Record<PlanId, Plan>,
    dataPath: readOptional("DATA_PATH") || "./data/subscriptions.json",
    nodeEnv: process.env.NODE_ENV?.trim() || "development",
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    webhookUrl: readOptional("WEBHOOK_URL"),
    webhookSecret: readOptional("WEBHOOK_SECRET"),
  } as const;
}

export const config = loadConfig();
export type AppConfig = typeof config;

export function getPlan(id: string): Plan | undefined {
  if (id === "weekly" || id === "monthly") {
    return config.plans[id];
  }
  return undefined;
}
