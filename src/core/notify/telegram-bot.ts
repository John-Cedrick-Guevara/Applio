import type { BotMessage } from './messages';

/** One update from `getUpdates`; Applio only acts on button presses. */
export interface Update {
  update_id: number;
  callback_query?: { id: string; data?: string; message?: { chat: { id: number } } };
}

/** The Bot API calls Applio makes. @throws an operator-readable error that never holds the token. */
export interface BotApi {
  /** Long-polls for updates after `offset`. */
  getUpdates(offset?: number): Promise<Update[]>;
  sendMessage(chatId: string, text: string, buttons?: BotMessage['buttons']): Promise<void>;
  answerCallback(callbackId: string, text: string): Promise<void>;
}

export interface BotPorts {
  chatId: string;
  /** The next update id to ask for, stored so a restart neither repeats nor drops a press. */
  offset: () => number | undefined;
  saveOffset: (offset: number) => void;
  wasNotified: (key: string) => boolean;
  markNotified: (key: string) => void;
  /** The in-app approve, as sent by the operator on Telegram. @returns What happened, to post back. */
  approve: (jobId: string) => Promise<string>;
  skip: (jobId: string) => Promise<string>;
  /** Brings the app up on the job. */
  open: (jobId: string) => void;
}

/**
 * The Telegram side of Applio (SPEC F9): sends notifications to the operator's
 * chat, at most once each, and turns their button presses into the same actions
 * as the app. Presses from any other chat are skipped without a reply.
 */
export function createTelegramBot(api: BotApi, ports: BotPorts) {
  const act = async (action: string, jobId: string): Promise<string | undefined> => {
    if (action === 'approve') return ports.approve(jobId).catch((err: unknown) => `Couldn't approve: ${err instanceof Error ? err.message : String(err)}`);
    if (action === 'skip') return ports.skip(jobId).catch((err: unknown) => `Couldn't skip: ${err instanceof Error ? err.message : String(err)}`);
    if (action === 'open') ports.open(jobId);
    return undefined;
  };

  return {
    /** Sends `message` unless a message with this key was sent before. */
    async notify(key: string, message: BotMessage): Promise<void> {
      if (ports.wasNotified(key)) return;
      await api.sendMessage(ports.chatId, message.text, message.buttons);
      ports.markNotified(key);
    },

    /**
     * Handles one batch of updates.
     * @throws the API's error on a network problem; the caller backs off and retries.
     */
    async poll(): Promise<void> {
      for (const update of await api.getUpdates(ports.offset())) {
        // Moving the offset first means a press that fails mid-way isn't replayed forever.
        ports.saveOffset(update.update_id + 1);
        const press = update.callback_query;
        if (!press || String(press.message?.chat.id) !== ports.chatId) continue;
        const [action = '', jobId = ''] = (press.data ?? '').split(':');
        if (!jobId) continue;
        await api.answerCallback(press.id, action === 'open' ? 'Opening Applio…' : 'Working on it…');
        const result = await act(action, jobId);
        if (result) await api.sendMessage(ports.chatId, result);
      }
    },
  };
}
