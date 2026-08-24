import type { Context } from "grammy";
import { homeKeyboard, referralJoinKeyboard } from "../keyboards/main.js";
import { createOrGetProfile, startReferral } from "../services/lovableApi.js";
import { editOrReply } from "../services/telegram.js";
import {
  isValidReferralCode,
  isWebsiteCampaign,
  normalizeStartParameter,
  telegramIdFromContext,
} from "../utils/formatting.js";
import { logger } from "../utils/logger.js";

export const HOME_TEXT = [
  "🔥 EDDY CALLS REFERRAL RACE",
  "",
  "Invite real members.",
  "Climb the leaderboard.",
  "Compete for SOL prizes.",
  "",
  "Join Eddy Calls, verify your membership and receive your personal referral link.",
].join("\n");

const REFERRAL_JOIN_TEXT = [
  "🎉 You're joining through a friend's referral link.",
  "",
  "Join Eddy Calls below and press Verify Membership.",
  "",
  "Your referral only counts after your membership is verified.",
].join("\n");

function profilePayload(ctx: Context) {
  const telegramId = telegramIdFromContext(ctx);
  if (!telegramId || !ctx.from) {
    return null;
  }

  return {
    telegram_id: telegramId,
    telegram_username: ctx.from.username?.trim() || null,
    first_name: ctx.from.first_name?.trim() || null,
  };
}

async function showHome(ctx: Context): Promise<void> {
  await editOrReply(ctx, HOME_TEXT, homeKeyboard());
}

export async function handleHome(ctx: Context): Promise<void> {
  const payload = profilePayload(ctx);
  if (!payload) {
    return;
  }

  await createOrGetProfile(payload);
  await showHome(ctx);
}

export async function handleStart(ctx: Context): Promise<void> {
  const payload = profilePayload(ctx);
  if (!payload) {
    return;
  }

  await createOrGetProfile(payload);

  const startParameter = ctx.callbackQuery
    ? null
    : normalizeStartParameter(typeof ctx.match === "string" ? ctx.match : undefined);

  if (!startParameter || isWebsiteCampaign(startParameter)) {
    await showHome(ctx);
    return;
  }

  if (!isValidReferralCode(startParameter)) {
    logger.warn("Ignored invalid or oversized /start parameter");
    await showHome(ctx);
    return;
  }

  const result = await startReferral(payload.telegram_id, startParameter);

  if (result.status === "created") {
    await editOrReply(ctx, REFERRAL_JOIN_TEXT, referralJoinKeyboard());
    return;
  }

  if (result.status === "already_attributed") {
    await showHome(ctx);
    return;
  }

  if (result.status === "self_referral") {
    await ctx.reply("You can't use your own referral link.");
    await ctx.reply(HOME_TEXT, {
      reply_markup: homeKeyboard(),
      link_preview_options: { is_disabled: true },
    });
    return;
  }

  await ctx.reply("That referral link is invalid.");
  await ctx.reply(HOME_TEXT, {
    reply_markup: homeKeyboard(),
    link_preview_options: { is_disabled: true },
  });
}
