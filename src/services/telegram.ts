import { GrammyError, type Api, type Context, type InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const ACTIVE_MEMBER_STATUSES = new Set(["creator", "administrator", "member"]);

export class TelegramServiceError extends Error {
  readonly code: "membership_check_failed" | "not_a_member";

  constructor(code: "membership_check_failed" | "not_a_member", message: string) {
    super(message);
    this.name = "TelegramServiceError";
    this.code = code;
  }
}

export function getChannelUrl(): string {
  return `https://t.me/${config.telegramChannelUsername}`;
}

export function createReferralShareUrl(referralUrl: string): string {
  const text = [
    "🔥 Join Eddy Calls and enter the SOL Referral Race.",
    "",
    "Join through my link, verify your membership and start competing for SOL rewards.",
  ].join("\n");

  const share = new URL("https://t.me/share/url");
  share.searchParams.set("url", referralUrl);
  share.searchParams.set("text", text);
  return share.toString();
}

export function buildReferralUrl(referralCode: string): string {
  return `https://t.me/${config.telegramBotUsername}?start=${encodeURIComponent(referralCode)}`;
}

function isNotAMemberError(error: unknown): boolean {
  if (!(error instanceof GrammyError)) {
    return false;
  }
  return /user not found|not a member|PARTICIPANT|MEMBER_NOT_FOUND|USER_NOT_PARTICIPANT/i.test(
    error.description,
  );
}

export async function checkChannelMembership(api: Api, telegramUserId: number): Promise<boolean> {
  try {
    const member = await api.getChatMember(config.telegramChannelId, telegramUserId);

    if (ACTIVE_MEMBER_STATUSES.has(member.status)) {
      return true;
    }

    if (member.status === "restricted" && "is_member" in member && member.is_member) {
      return true;
    }

    return false;
  } catch (error) {
    if (isNotAMemberError(error)) {
      return false;
    }

    logger.error("Telegram membership check failed");
    throw new TelegramServiceError("membership_check_failed", "Telegram membership check failed");
  }
}

function isMessageNotModified(error: unknown): boolean {
  return error instanceof GrammyError && /message is not modified/i.test(error.description);
}

export async function editOrReply(
  ctx: Context,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  const extra = {
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true as const },
  };

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch (error) {
      if (isMessageNotModified(error)) {
        return;
      }
    }
  }

  await ctx.reply(text, extra);
}

export async function answerCallback(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery) {
    return;
  }
  try {
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.warn("Failed to answer callback query", error);
  }
}
