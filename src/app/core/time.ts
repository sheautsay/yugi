// Stored times are ISO 8601 UTC; everything shown to the user is the browser's local wall-clock
// time (Taiwan: UTC+8). Unparseable values are shown as they are.

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" in local time (also used for the daily request count and file names). */
export function localDate(value: string | number | Date = new Date()): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD HH:mm:ss" in local time. */
export function localDateTime(value: string | number | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
