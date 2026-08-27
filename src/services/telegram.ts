import { GrammyError, type Context, type InlineKeyboard } from "grammy";
import { logger } from "../utils/logger.js";

function isMessageNotModified(error: unknown): boolean {
  return error instanceof GrammyError && /message is not modified/i.test(error.description);
}

export async function editOrReply(
  ctx: Context,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  const extra = {
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true as const },
  };

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch (error) {
      if (isMessageNotModified(error)) {
        return;
      }
    }
  }

  await ctx.reply(text, extra);
}

export async function answerCallback(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery) {
    return;
  }
  try {
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.warn("Failed to answer callback query", error);
  }
}
