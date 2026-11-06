// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createBotApi } from './bot-api';

const TOKEN = '123456:ABC-secret-token';
const ok = (result: unknown) => new Response(JSON.stringify({ ok: true, result }), { status: 200 });

describe('Telegram Bot API client', () => {
  it('sends a message with its buttons as an inline keyboard', async () => {
    const fetch = vi.fn(async () => ok({}));
    await createBotApi(TOKEN, fetch).sendMessage('42', 'Hi', [[{ text: 'Approve', data: 'approve:j1' }]]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(String(init.body))).toEqual({ chat_id: '42', text: 'Hi', reply_markup: { inline_keyboard: [[{ text: 'Approve', callback_data: 'approve:j1' }]] } });
  });

  it('long-polls for button presses after the offset', async () => {
    const fetch = vi.fn(async () => ok([{ update_id: 7 }]));
    expect(await createBotApi(TOKEN, fetch).getUpdates(7)).toEqual([{ update_id: 7 }]);
    expect(JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ offset: 7, timeout: 30, allowed_updates: ['callback_query'] });
  });

  it("explains Telegram's refusal without the token", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: false, description: 'Bad Request: chat not found' }), { status: 400 }));
    const err = await createBotApi(TOKEN, fetch).sendMessage('42', 'Hi').catch((e: Error) => e);
    expect((err as Error).message).toBe('Telegram refused: Bad Request: chat not found');
    expect(String((err as Error).stack) + String((err as Error).cause)).not.toContain(TOKEN);
  });

  it('says the token is wrong on a 401, and that Telegram is unreachable on a network error, never quoting the URL', async () => {
    const unauthorized = vi.fn(async () => new Response(JSON.stringify({ ok: false, description: 'Unauthorized' }), { status: 401 }));
    await expect(createBotApi(TOKEN, unauthorized).sendMessage('42', 'x')).rejects.toThrow('Telegram rejected the bot token. Copy it from @BotFather and save it again.');
    const down = vi.fn(async () => Promise.reject(new TypeError(`fetch failed for https://api.telegram.org/bot${TOKEN}/getUpdates`)));
    const err = await createBotApi(TOKEN, down).getUpdates().catch((e: Error) => e);
    expect((err as Error).message).toBe("Couldn't reach Telegram.");
    expect(JSON.stringify(err) + (err as Error).message + String((err as Error).cause)).not.toContain(TOKEN);
  });
});
