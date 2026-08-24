import type { Context } from "grammy";

export const SERVICE_UNAVAILABLE_TEXT =
  "⚠️ Eddy Calls services are temporarily unavailable.\n\nPlease try again shortly.";

export const TELEGRAM_UNAVAILABLE_TEXT =
  "⚠️ Telegram is temporarily unavailable.\n\nPlease try again shortly.";

export function formatRank(rank: number | null | undefined): string {
  if (typeof rank !== "number" || !Number.isFinite(rank) || rank < 1) {
    return "Not ranked yet";
  }
  return `#${Math.trunc(rank)}`;
}

export function formatSol(amount: number | null | undefined): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "TBD";
  }
  const normalized = Number.isInteger(amount) ? String(amount) : String(amount);
  return `${normalized} SOL`;
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "0";
  }
  return String(Math.trunc(value));
}

export function formatContestEnd(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "TBD";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

export function displayUsername(value: string | null | undefined): string {
  const username = value?.trim();
  if (!username) {
    return "Anonymous";
  }
  return username;
}

export function formatMilestone(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "All milestones reached";
  }
  return `${Math.trunc(value)} referrals`;
}

export function telegramIdFromContext(ctx: Context): string | null {
  const id = ctx.from?.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    return null;
  }
  return String(id);
}

export function isValidTelegramId(value: string): boolean {
  return /^\d{1,20}$/.test(value);
}

export function normalizeStartParameter(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  if (value.length > 32) {
    return null;
  }
  return value;
}

export function isWebsiteCampaign(parameter: string): boolean {
  return parameter.toLowerCase() === "website";
}

export function isValidReferralCode(value: string): boolean {
  return /^[A-Za-z0-9_-]{4,32}$/.test(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function readString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

export function readNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  if ("data" in record && record.data !== undefined) {
    return record.data;
  }
  if ("result" in record && record.result && typeof record.result === "object") {
    return record.result;
  }
  return value;
}
