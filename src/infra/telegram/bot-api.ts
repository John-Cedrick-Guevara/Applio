import type { BotApi, Update } from '../../core/notify/telegram-bot';
import { AppError } from '../../shared/errors';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Telegram refused or couldn't be reached. Never carries the token, which is part of every request URL. */
export class TelegramError extends AppError {
  constructor(message: string) {
    super('telegram_failed', message);
  }
}

/** Long-poll length; Telegram holds the request open until a press arrives or this runs out. */
const POLL_SECONDS = 30;

/**
 * The Bot API over HTTPS JSON (SPEC F9), with no library. Errors are rebuilt
 * from Telegram's description and never wrap the original, whose message can
 * quote the URL and so the token (MNB-2).
 */
export function createBotApi(token: string, fetch: Fetch): BotApi {
  const call = async <T>(method: string, body: object): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new TelegramError("Couldn't reach Telegram.");
    }
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (res.status === 401) throw new TelegramError('Telegram rejected the bot token. Copy it from @BotFather and save it again.');
    if (!data.ok) throw new TelegramError(`Telegram refused: ${data.description ?? `HTTP ${res.status}`}`);
    return data.result as T;
  };

  return {
    getUpdates: (offset) => call<Update[]>('getUpdates', { ...(offset !== undefined ? { offset } : {}), timeout: POLL_SECONDS, allowed_updates: ['callback_query'] }),
    sendMessage: async (chatId, text, buttons) => {
      await call('sendMessage', {
        chat_id: chatId, text,
        ...(buttons ? { reply_markup: { inline_keyboard: buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) } } : {}),
      });
    },
    answerCallback: async (callbackId, text) => {
      await call('answerCallbackQuery', { callback_query_id: callbackId, text });
    },
  };
}
