import type { Context } from "grammy";
import { config } from "../config.js";
import { homeKeyboard } from "../keyboards/main.js";
import { editOrReply } from "../services/telegram.js";
import { displayName } from "../utils/formatting.js";

function channelHandle(): string {
  return config.telegramChannelUsername ? `@${config.telegramChannelUsername}` : config.channelName;
}

export function homeText(ctx: Context): string {
  const { weekly, monthly } = config.plans;
  return [
    `👋 Welcome, ${displayName(ctx)}!`,
    "",
    `Subscribe for private access to ${channelHandle()}.`,
    "",
    "Plans:",
    `• ${weekly.title} — ${weekly.stars} Stars · ${weekly.days} days`,
    `• ${monthly.title} — ${monthly.stars} Stars · ${monthly.days} days`,
    "",
    "Pay with Telegram Stars. After payment you'll get a one-time invite link.",
    "",
    "Choose an option below 👇",
  ].join("\n");
}

export async function handleHome(ctx: Context): Promise<void> {
  await editOrReply(ctx, homeText(ctx), homeKeyboard());
}

export async function handleStart(ctx: Context): Promise<void> {
  await handleHome(ctx);
}
