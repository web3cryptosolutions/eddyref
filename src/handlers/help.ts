import type { Context } from "grammy";
import { helpKeyboard } from "../keyboards/main.js";
import { editOrReply } from "../services/telegram.js";

const HELP_TEXT = [
  "Eddy Calls referral bot commands:",
  "",
  "/start — Contest home",
  "/referral — Get your referral link",
  "/stats — View your stats",
  "/leaderboard — View top referrers",
  "/contest — Contest information",
  "/help — Help",
].join("\n");

export async function handleHelp(ctx: Context): Promise<void> {
  await editOrReply(ctx, HELP_TEXT, helpKeyboard());
}
