import type { Context } from "grammy";
import { statsKeyboard } from "../keyboards/main.js";
import { getStats } from "../services/lovableApi.js";
import { buildReferralUrl, editOrReply } from "../services/telegram.js";
import { formatCount, formatMilestone, formatRank, telegramIdFromContext } from "../utils/formatting.js";

export async function handleStats(ctx: Context): Promise<void> {
  const telegramId = telegramIdFromContext(ctx);
  if (!telegramId) {
    return;
  }

  const stats = await getStats(telegramId);
  const referralUrl = stats.referral_url || (stats.referral_code ? buildReferralUrl(stats.referral_code) : "Not available yet");

  const text = [
    "📊 YOUR REFERRAL STATS",
    "",
    `🏆 Rank: ${formatRank(stats.rank)}`,
    `👥 Valid referrals: ${formatCount(stats.valid_referrals)}`,
    `⏳ Pending referrals: ${formatCount(stats.pending_referrals)}`,
    `❌ Invalid referrals: ${formatCount(stats.invalid_referrals)}`,
    `🎯 Next milestone: ${formatMilestone(stats.next_milestone)}`,
    "",
    "Your referral link:",
    "",
    referralUrl,
  ].join("\n");

  await editOrReply(ctx, text, statsKeyboard());
}
