import { InlineKeyboard } from "grammy";
import { getChannelUrl } from "../services/telegram.js";

export const CALLBACK = {
  home: "home",
  verify: "verify",
  referral: "referral",
  stats: "stats",
  leaderboard: "leaderboard",
} as const;

export function homeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .url("🚀 JOIN EDDY CALLS", getChannelUrl())
    .row()
    .text("✅ VERIFY MEMBERSHIP", CALLBACK.verify)
    .row()
    .text("🔗 MY REFERRAL LINK", CALLBACK.referral)
    .row()
    .text("📊 MY STATS", CALLBACK.stats)
    .row()
    .text("🏆 LEADERBOARD", CALLBACK.leaderboard);
}

export function referralJoinKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .url("JOIN EDDY CALLS", getChannelUrl())
    .row()
    .text("VERIFY MEMBERSHIP", CALLBACK.verify);
}

export function membershipMissingKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .url("JOIN EDDY CALLS", getChannelUrl())
    .row()
    .text("VERIFY AGAIN", CALLBACK.verify);
}

export function verifiedKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔗 GET MY REFERRAL LINK", CALLBACK.referral)
    .row()
    .text("📊 MY STATS", CALLBACK.stats)
    .row()
    .text("🏆 LEADERBOARD", CALLBACK.leaderboard);
}

export function referralShareKeyboard(shareUrl: string): InlineKeyboard {
  return new InlineKeyboard().url("📤 SHARE ON TELEGRAM", shareUrl);
}

export function leaderboardKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔗 MY REFERRAL LINK", CALLBACK.referral)
    .row()
    .text("🔄 REFRESH LEADERBOARD", CALLBACK.leaderboard);
}

export function helpKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔥 CONTEST HOME", CALLBACK.home)
    .row()
    .text("🔗 MY REFERRAL LINK", CALLBACK.referral);
}

export function statsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔗 MY REFERRAL LINK", CALLBACK.referral)
    .row()
    .text("🏆 LEADERBOARD", CALLBACK.leaderboard)
    .row()
    .text("🔥 CONTEST HOME", CALLBACK.home);
}

export function contestKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🏆 LEADERBOARD", CALLBACK.leaderboard)
    .row()
    .text("🔥 CONTEST HOME", CALLBACK.home);
}
