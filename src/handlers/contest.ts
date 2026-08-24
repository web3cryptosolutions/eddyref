import type { Context } from "grammy";
import { contestKeyboard } from "../keyboards/main.js";
import { getContest } from "../services/lovableApi.js";
import { editOrReply } from "../services/telegram.js";
import { formatContestEnd, formatSol } from "../utils/formatting.js";

function formatContestValue(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "TBD";
  }
  return String(value);
}

export async function handleContest(ctx: Context): Promise<void> {
  const contest = await getContest();

  const text = [
    "🔥 EDDY CALLS REFERRAL RACE",
    "",
    `🥇 1st: ${formatSol(contest.firstPrize)}`,
    `🥈 2nd: ${formatSol(contest.secondPrize)}`,
    `🥉 3rd: ${formatSol(contest.thirdPrize)}`,
    "",
    "Bonus:",
    `${formatContestValue(contest.bonusWinners)} winners × ${formatSol(contest.bonusAmount)}`,
    "",
    "Minimum referrals:",
    formatContestValue(contest.minReferrals),
    "",
    "Ends:",
    formatContestEnd(contest.endsAt),
  ].join("\n");

  await editOrReply(ctx, text, contestKeyboard());
}
