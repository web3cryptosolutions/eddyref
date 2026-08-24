import type { Context } from "grammy";
import { membershipMissingKeyboard, verifiedKeyboard } from "../keyboards/main.js";
import { verifyReferral } from "../services/lovableApi.js";
import { checkChannelMembership, editOrReply } from "../services/telegram.js";
import { telegramIdFromContext } from "../utils/formatting.js";

const NOT_A_MEMBER_TEXT = [
  "❌ Membership not detected yet.",
  "",
  "Join Eddy Calls first, then come back and press Verify Membership again.",
].join("\n");

const VERIFIED_TEXT = [
  "✅ Membership verified!",
  "",
  "Welcome to Eddy Calls.",
  "",
  "Your referral status has been updated.",
  "",
  "You can now get your personal referral link and start inviting friends.",
].join("\n");

export async function handleVerify(ctx: Context): Promise<void> {
  const telegramId = telegramIdFromContext(ctx);
  if (!telegramId || !ctx.from) {
    return;
  }

  const isMember = await checkChannelMembership(ctx.api, ctx.from.id);
  if (!isMember) {
    await editOrReply(ctx, NOT_A_MEMBER_TEXT, membershipMissingKeyboard());
    return;
  }

  await verifyReferral(telegramId, true);
  await editOrReply(ctx, VERIFIED_TEXT, verifiedKeyboard());
}
