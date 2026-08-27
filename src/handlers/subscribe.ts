import type { Context } from "grammy";
import { config, getPlan, type Plan, type PlanId } from "../config.js";
import { paidKeyboard, plansKeyboard } from "../keyboards/main.js";
import { createInviteLink, restoreChannelAccess } from "../services/access.js";
import { editOrReply } from "../services/telegram.js";
import { getSubscription, isActive, upsertPayment } from "../store/subscriptions.js";
import { formatExpiry, telegramIdFromContext } from "../utils/formatting.js";
import { logger } from "../utils/logger.js";

const SUBSCRIBE_TEXT = [
  "Choose a plan. Payment is handled by Telegram Stars — no card details are shared with this bot.",
  "",
  "If you already have access, a new payment extends your current expiry date.",
].join("\n");

export async function handleSubscribe(ctx: Context): Promise<void> {
  await editOrReply(ctx, SUBSCRIBE_TEXT, plansKeyboard());
}

export async function handlePlan(ctx: Context, planId: PlanId): Promise<void> {
  const plan = getPlan(planId);
  const telegramId = telegramIdFromContext(ctx);
  if (!plan || !telegramId || !ctx.from) {
    return;
  }

  const payload = `${telegramId}:${plan.id}`;
  await ctx.replyWithInvoice(
    `${plan.title} access`.slice(0, 32),
    `${plan.days} days of private access to ${config.channelName}`.slice(0, 255),
    payload,
    "XTR",
    [{ label: `${plan.title} subscription`, amount: plan.stars }],
  );
}

export async function handlePreCheckout(ctx: Context): Promise<void> {
  const query = ctx.preCheckoutQuery;
  if (!query) {
    return;
  }

  const plan = planFromPayload(query.invoice_payload, query.from.id);
  if (!plan || query.currency !== "XTR" || query.total_amount !== plan.stars) {
    await ctx.answerPreCheckoutQuery(false, {
      error_message: "This plan is no longer available. Please pick a plan again.",
    });
    return;
  }

  await ctx.answerPreCheckoutQuery(true);
}

export async function handleSuccessfulPayment(ctx: Context): Promise<void> {
  const payment = ctx.message?.successful_payment;
  const telegramId = telegramIdFromContext(ctx);
  if (!payment || !telegramId || !ctx.from) {
    return;
  }

  const plan = planFromPayload(payment.invoice_payload, ctx.from.id);
  if (!plan) {
    logger.error("Successful payment with unknown payload");
    return;
  }

  const subscription = await upsertPayment({
    telegramId,
    username: ctx.from.username?.trim() || null,
    firstName: ctx.from.first_name?.trim() || null,
    plan: plan.id,
    days: plan.days,
    stars: plan.stars,
    telegramPaymentChargeId: payment.telegram_payment_charge_id,
  });

  await restoreChannelAccess(ctx.api, ctx.from.id);

  try {
    const inviteUrl = await createInviteLink(ctx.api, ctx.from.id);
    const text = [
      "✅ Payment received.",
      "",
      `${plan.title} access is active until ${formatExpiry(subscription.expiresAt)}.`,
      "",
      "Tap below to join. This invite can be used once and expires in 1 hour.",
    ].join("\n");
    await ctx.reply(text, { reply_markup: paidKeyboard(inviteUrl) });
  } catch (error) {
    logger.error("Paid subscriber but failed to create invite link", error);
    await ctx.reply(
      [
        "✅ Payment received, but I could not create an invite link.",
        "",
        "The bot must be an admin of the private channel with permission to invite users.",
        "Your subscription is saved — use My Subscription after that is fixed.",
      ].join("\n"),
    );
  }
}

export async function handleInvite(ctx: Context): Promise<void> {
  const telegramId = telegramIdFromContext(ctx);
  if (!telegramId || !ctx.from) {
    return;
  }

  const subscription = await getSubscription(telegramId);
  if (!isActive(subscription)) {
    await editOrReply(ctx, "You don't have an active subscription yet.", plansKeyboard());
    return;
  }

  await restoreChannelAccess(ctx.api, ctx.from.id);
  const inviteUrl = await createInviteLink(ctx.api, ctx.from.id);
  await ctx.reply("Here's a fresh one-time invite. It expires in 1 hour.", {
    reply_markup: paidKeyboard(inviteUrl),
  });
}

function planFromPayload(payload: string, userId: number): Plan | undefined {
  const expectedPrefix = `${userId}:`;
  if (!payload.startsWith(expectedPrefix)) {
    return undefined;
  }
  return getPlan(payload.slice(expectedPrefix.length));
}
