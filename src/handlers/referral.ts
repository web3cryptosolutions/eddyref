import type { Context } from "grammy";
import { referralShareKeyboard } from "../keyboards/main.js";
import { getStats } from "../services/lovableApi.js";
import { buildReferralUrl, createReferralShareUrl, editOrReply } from "../services/telegram.js";
import { formatCount, formatRank, telegramIdFromContext } from "../utils/formatting.js";

export async function handleReferral(ctx: Context): Promise<void> {
  const telegramId = telegramIdFromContext(ctx);
  if (!telegramId) {
    return;
  }

  const stats = await getStats(telegramId);
  const referralUrl = stats.referral_url || (stats.referral_code ? buildReferralUrl(stats.referral_code) : "");

  if (!referralUrl) {
    await editOrReply(
      ctx,
      [
        "🔗 YOUR EDDY CALLS REFERRAL LINK",
        "",
        "Your referral link is not ready yet.",
        "Verify your membership first, then try again.",
      ].join("\n"),
    );
    return;
  }

  const text = [
    "🔗 YOUR EDDY CALLS REFERRAL LINK",
    "",
    referralUrl,
    "",
    `Valid referrals: ${formatCount(stats.valid_referrals)}`,
    "",
    `Current rank: ${formatRank(stats.rank)}`,
    "",
    "Send this link to your friends.",
    "",
    "They must join Eddy Calls and verify their membership for the referral to count.",
  ].join("\n");

  await editOrReply(ctx, text, referralShareKeyboard(createReferralShareUrl(referralUrl)));
}
