// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { employmentFrom, htmlToText, isoFrom, repairMojibake } from './normalize';

describe('normalize', () => {
  it('turns HTML into plain lines, decoding entities', () => {
    expect(htmlToText('<p>Build &amp; ship</p><ul><li>Node</li><li>SQL &#8217;s</li></ul>Done<br>now')).toBe('Build & ship\n- Node\n- SQL ’s\nDone\nnow');
  });

  it('repairs double-encoded UTF-8 and leaves correct or ambiguous text alone', () => {
    expect(repairMojibake('HÃ¤user â\u0080\u0099 and… café')).toBe('Häuser ’ and… café');
    expect(repairMojibake('Price: Â')).toBe('Price: Â');
  });

  it("maps boards' job types to ours", () => {
    expect([employmentFrom('Full-Time'), employmentFrom(['Contractor']), employmentFrom('freelance'), employmentFrom('Internship'), employmentFrom(null)])
      .toEqual(['full-time', 'contract', 'freelance', undefined, undefined]);
  });

  it('reads epoch seconds and zone-less dates as UTC', () => {
    expect(isoFrom(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(isoFrom('2026-11-02T20:01:00')).toBe('2026-11-02T20:01:00.000Z');
    expect(isoFrom('2026-11-05T05:44:53+00:00')).toBe('2026-11-05T05:44:53.000Z');
  });
});
