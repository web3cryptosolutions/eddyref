import type { Api } from "grammy";
import { GrammyError } from "grammy";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const INVITE_TTL_SECONDS = 60 * 60;

function isIgnorableKickError(error: unknown): boolean {
  if (!(error instanceof GrammyError)) {
    return false;
  }
  return /user not found|USER_NOT_PARTICIPANT|PARTICIPANT_ID_INVALID|can't remove chat owner/i.test(
    error.description,
  );
}

export async function createInviteLink(api: Api, telegramUserId: number): Promise<string> {
  const expireDate = Math.floor(Date.now() / 1000) + INVITE_TTL_SECONDS;
  const invite = await api.createChatInviteLink(config.telegramChannelId, {
    name: `sub-${telegramUserId}`.slice(0, 32),
    member_limit: 1,
    expire_date: expireDate,
  });
  return invite.invite_link;
}

export async function restoreChannelAccess(api: Api, telegramUserId: number): Promise<void> {
  try {
    await api.unbanChatMember(config.telegramChannelId, telegramUserId, { only_if_banned: true });
  } catch (error) {
    logger.warn("Failed to unban subscriber before issuing invite", error);
  }
}

export async function revokeChannelAccess(api: Api, telegramUserId: number): Promise<void> {
  try {
    await api.banChatMember(config.telegramChannelId, telegramUserId);
  } catch (error) {
    if (isIgnorableKickError(error)) {
      return;
    }
    logger.error("Failed to remove expired subscriber from channel", error);
  }
}
