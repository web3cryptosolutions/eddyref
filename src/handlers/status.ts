import type { Context } from "grammy";
import { statusKeyboard } from "../keyboards/main.js";
import { editOrReply } from "../services/telegram.js";
import { getSubscription, isActive } from "../store/subscriptions.js";
import { formatExpiry, remainingDays, telegramIdFromContext } from "../utils/formatting.js";

export async function handleStatus(ctx: Context): Promise<void> {
  const telegramId = telegramIdFromContext(ctx);
  if (!telegramId) {
    return;
  }

  const subscription = await getSubscription(telegramId);
  if (!isActive(subscription) || !subscription) {
    await editOrReply(
      ctx,
      "You don't have an active subscription.\n\nSubscribe to get a private invite to the channel.",
      statusKeyboard(false),
    );
    return;
  }

  const days = remainingDays(subscription.expiresAt);
  await editOrReply(
    ctx,
    [
      "✅ Your subscription is active.",
      "",
      `Plan: ${subscription.plan === "weekly" ? "Weekly" : "Monthly"}`,
      `Expires: ${formatExpiry(subscription.expiresAt)}`,
      `Time left: ${days} day${days === 1 ? "" : "s"}`,
      "",
      "Need to join again? Request a new one-time invite below.",
    ].join("\n"),
    statusKeyboard(true),
  );
}
