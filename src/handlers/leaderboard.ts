import type { Context } from "grammy";
import { leaderboardKeyboard } from "../keyboards/main.js";
import { getLeaderboard, getStats } from "../services/lovableApi.js";
import { editOrReply } from "../services/telegram.js";
import { displayUsername, formatCount, formatRank, telegramIdFromContext } from "../utils/formatting.js";

function medalFor(rank: number, index: number): string {
  if (rank === 1 || index === 0) {
    return "🥇";
  }
  if (rank === 2 || index === 1) {
    return "🥈";
  }
  if (rank === 3 || index === 2) {
    return "🥉";
  }
  return `${rank}.`;
}

export async function handleLeaderboard(ctx: Context): Promise<void> {
  const telegramId = telegramIdFromContext(ctx);
  if (!telegramId) {
    return;
  }

  const [rows, stats] = await Promise.all([getLeaderboard(10), getStats(telegramId)]);

  const lines = ["🏆 EDDY CALLS LEADERBOARD", ""];

  if (rows.length === 0) {
    lines.push("No rankings yet. Be the first to invite friends and compete for SOL rewards.");
  } else {
    rows.forEach((row, index) => {
      const rank = row.rank && row.rank > 0 ? row.rank : index + 1;
      const name = displayUsername(row.username);
      const count = formatCount(row.valid_referrals);
      if (rank <= 3) {
        lines.push(`${medalFor(rank, index)} ${name} — ${count} referrals`);
        lines.push("");
      } else {
        lines.push(`${rank}. ${name} — ${count}`);
      }
    });
  }

  lines.push(
    "",
    `Your rank: ${formatRank(stats.rank)}`,
    "",
    `Your referrals: ${formatCount(stats.valid_referrals)}`,
  );

  await editOrReply(ctx, lines.join("\n"), leaderboardKeyboard());
}
