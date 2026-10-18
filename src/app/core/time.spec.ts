import { localDate, localDateTime } from './time';

// Stored times are UTC; shown times follow the local clock. The expected values are built from
// the same instant's local fields, so the test holds in any time zone (Taiwan: UTC+8).
describe('local time display', () => {
  const iso = '2026-10-09T02:17:23.000Z';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  it('shows a stored UTC time in local time, not the raw ISO string', () => {
    expect(localDateTime(iso)).toBe(expected);
    expect(localDateTime(iso)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(localDate(iso)).toBe(expected.slice(0, 10));
  });

  it('in Taiwan (UTC+8) the example is 10:17:23', () => {
    if (d.getTimezoneOffset() !== -480) return; // only meaningful on a UTC+8 machine; E2E pins Asia/Taipei
    expect(localDateTime(iso)).toBe('2026-10-09 10:17:23');
    expect(localDate('2026-10-08T16:30:00.000Z')).toBe('2026-10-09'); // 00:30 the next day locally
  });

  it('leaves unparseable values as they are', () => {
    expect(localDateTime('not a date')).toBe('not a date');
  });
});
