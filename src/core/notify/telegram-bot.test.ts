import { describe, expect, it, vi } from 'vitest';
import type { Job } from '../../shared/types';
import { draftReady, newMatch } from './messages';
import { createTelegramBot, type BotApi, type BotPorts, type Update } from './telegram-bot';

const CHAT = '12345';
const job = { id: 'j1', company: 'Acme', title: 'Senior Backend Engineer', score: 88, roleSummary: 'Builds billing APIs.', channel: 'email' } as Job;

/** A fake Bot API: queued updates, and every message the bot sent. */
const setup = (updates: Update[][] = []) => {
  const sent: { chatId: string; text: string; buttons?: unknown }[] = [];
  const api: BotApi = {
    getUpdates: vi.fn(async () => updates.shift() ?? []),
    sendMessage: vi.fn(async (chatId, text, buttons) => void sent.push({ chatId, text, ...(buttons ? { buttons } : {}) })),
    answerCallback: vi.fn(async () => {}),
  };
  let offset: number | undefined;
  const notified = new Set<string>();
  const ports: BotPorts = {
    chatId: CHAT,
    offset: () => offset,
    saveOffset: (o) => void (offset = o),
    wasNotified: (key) => notified.has(key),
    markNotified: (key) => void notified.add(key),
    approve: vi.fn(async () => 'Sent to jobs@acme.com.'),
    skip: vi.fn(async () => 'Skipped.'),
    open: vi.fn(),
  };
  return { bot: createTelegramBot(api, ports), api, ports, sent, offset: () => offset };
};
const press = (id: number, data: string, chat = CHAT): Update => ({ update_id: id, callback_query: { id: `cb${id}`, data, message: { chat: { id: Number(chat) } } } });

describe('Telegram messages', () => {
  it('summarize a match without the letter', () => {
    expect(newMatch(job).text).toBe('New match · 88%\nSenior Backend Engineer at Acme\nBuilds billing APIs.');
  });

  it('offer Approve, Open and Skip on a draft', () => {
    expect(draftReady(job).buttons).toEqual([[{ text: 'Approve', data: 'approve:j1' }, { text: 'Open', data: 'open:j1' }, { text: 'Skip', data: 'skip:j1' }]]);
  });

  it('leave out one-tap Approve for a suspicious post, and say why', () => {
    const flagged = draftReady({ ...job, suspicious: 'The post tells automated tools to ignore their instructions.' });
    expect(flagged.buttons).toEqual([[{ text: 'Open', data: 'open:j1' }, { text: 'Skip', data: 'skip:j1' }]]);
    expect(flagged.text).toContain('This post looks like it tries to steer automated tools. Check the company in Applio before sending.');
  });
});

describe('Telegram bot', () => {
  it('sends a notification to the saved chat once, however often it is asked', async () => {
    const { bot, sent } = setup();
    await bot.notify('draft:j1', draftReady(job));
    await bot.notify('draft:j1', draftReady(job));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ chatId: CHAT, text: expect.stringContaining('Acme') });
  });

  it('approves from a button exactly as the app does, and posts the result back', async () => {
    const { bot, ports, sent, api } = setup([[press(10, 'approve:j1')]]);
    await bot.poll();
    expect(ports.approve).toHaveBeenCalledWith('j1');
    expect(api.answerCallback).toHaveBeenCalledWith('cb10', 'Working on it…');
    expect(sent.at(-1)).toEqual({ chatId: CHAT, text: 'Sent to jobs@acme.com.' });
  });

  it('posts the reason back when approval is refused', async () => {
    const { bot, ports, sent } = setup([[press(10, 'approve:j1')]]);
    vi.mocked(ports.approve).mockRejectedValueOnce(new Error("Gmail's daily cap is reached (100 sends today)."));
    await bot.poll();
    expect(sent.at(-1)?.text).toBe("Couldn't approve: Gmail's daily cap is reached (100 sends today).");
  });

  it('skips and opens from buttons', async () => {
    const { bot, ports } = setup([[press(10, 'skip:j1'), press(11, 'open:j1')]]);
    await bot.poll();
    expect(ports.skip).toHaveBeenCalledWith('j1');
    expect(ports.open).toHaveBeenCalledWith('j1');
  });

  it('ignores every chat but the saved one', async () => {
    const { bot, ports, sent } = setup([[press(10, 'approve:j1', '999')]]);
    await bot.poll();
    expect(ports.approve).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('asks for updates after the last one handled, so a restart never repeats a press', async () => {
    const { bot, api, offset } = setup([[press(10, 'skip:j1'), press(11, 'skip:j1')], []]);
    await bot.poll();
    expect(offset()).toBe(12);
    await bot.poll();
    expect(api.getUpdates).toHaveBeenLastCalledWith(12);
  });

  it('lets a network error through untouched, so the runner can back off', async () => {
    const { bot, api } = setup();
    vi.mocked(api.getUpdates).mockRejectedValueOnce(new Error("Couldn't reach Telegram."));
    await expect(bot.poll()).rejects.toThrow("Couldn't reach Telegram.");
  });
});
