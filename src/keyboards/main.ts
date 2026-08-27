import { InlineKeyboard } from "grammy";
import { config } from "../config.js";

export const CALLBACK = {
  home: "home",
  subscribe: "subscribe",
  weekly: "plan:weekly",
  monthly: "plan:monthly",
  status: "status",
  invite: "invite",
  help: "help",
} as const;

export function homeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💎 Subscribe", CALLBACK.subscribe)
    .row()
    .text("📊 My Subscription", CALLBACK.status)
    .row()
    .text("ℹ️ Help", CALLBACK.help);
}

export function plansKeyboard(): InlineKeyboard {
  const { weekly, monthly } = config.plans;
  return new InlineKeyboard()
    .text(`📅 ${weekly.title} — ${weekly.stars} Stars`, CALLBACK.weekly)
    .row()
    .text(`📅 ${monthly.title} — ${monthly.stars} Stars`, CALLBACK.monthly)
    .row()
    .text("⬅️ Back", CALLBACK.home);
}

export function statusKeyboard(active: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (active) {
    keyboard.text("🔗 Get invite link", CALLBACK.invite).row();
  }
  keyboard.text("💎 Subscribe", CALLBACK.subscribe).row().text("⬅️ Home", CALLBACK.home);
  return keyboard;
}

export function helpKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("💎 Subscribe", CALLBACK.subscribe).row().text("⬅️ Home", CALLBACK.home);
}

export function paidKeyboard(inviteUrl: string): InlineKeyboard {
  return new InlineKeyboard().url("🚀 Join channel", inviteUrl).row().text("📊 My Subscription", CALLBACK.status);
}
