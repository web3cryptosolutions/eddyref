import type { Context } from "grammy";

export const SERVICE_UNAVAILABLE_TEXT =
  "⚠️ Something went wrong while processing that.\n\nPlease try again shortly.";

export const TELEGRAM_UNAVAILABLE_TEXT =
  "⚠️ Telegram is temporarily unavailable.\n\nPlease try again shortly.";

export function telegramIdFromContext(ctx: Context): string | null {
  const id = ctx.from?.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    return null;
  }
  return String(id);
}

export function displayName(ctx: Context): string {
  const first = ctx.from?.first_name?.trim();
  if (first) {
    return first;
  }
  const username = ctx.from?.username?.trim();
  return username ? `@${username}` : "there";
}

export function formatExpiry(expiresAt: number): string {
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(expiresAt))} UTC`;
}

export function remainingDays(expiresAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));
}
