import type { Context } from "grammy";
import { config } from "../config.js";
import { helpKeyboard } from "../keyboards/main.js";
import { editOrReply } from "../services/telegram.js";

export async function handleHelp(ctx: Context): Promise<void> {
  const { weekly, monthly } = config.plans;
  await editOrReply(
    ctx,
    [
      "How this bot works:",
      "",
      "1. Choose Weekly or Monthly.",
      "2. Pay with Telegram Stars.",
      "3. Get a one-time invite to the private channel.",
      "",
      `Weekly: ${weekly.stars} Stars / ${weekly.days} days`,
      `Monthly: ${monthly.stars} Stars / ${monthly.days} days`,
      "",
      "Commands:",
      "/start — Home",
      "/subscribe — Choose a plan",
      "/status — Check your access",
      "/help — This message",
    ].join("\n"),
    helpKeyboard(),
  );
}
