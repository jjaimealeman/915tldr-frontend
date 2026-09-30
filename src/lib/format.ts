// 04-02: deterministic, machine-independent date formatting. Every build machine (a developer's
// laptop, a CI container, Cloudflare Workers Builds) can have a different host time zone — a
// byline computed with a Date locale-string convenience method or a host-zone getter (a bare
// `getHours()`/`getDate()`, or the locale-string method with no explicit `timeZone` option) would
// render a different wall-clock string on each one, breaking criterion 3's "byte-identical
// unchanged articles" requirement. Every function here takes `Intl.DateTimeFormat(..., {
// timeZone: TIME_ZONE }).formatToParts()` as its only source of wall-clock truth. This is a pure,
// build-anywhere module with no dependency on the D1-access boundary the rest of this project
// enforces.

/** El Paso is Mountain Time — every dateline, byline and ISO timestamp this project renders is
 * computed in this zone, never the host machine's local zone. */
export const TIME_ZONE = 'America/Denver';

// AP style: three-letter months are abbreviated with a period; March, April, May, June and July
// are spelled out in full (they're already short or don't abbreviate cleanly).
const AP_MONTHS = [
  'Jan.',
  'Feb.',
  'March',
  'April',
  'May',
  'June',
  'July',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
] as const;

function partsFor(date: Date, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, ...options }).formatToParts(date);
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

export interface FormatBylineTimeOptions {
  /** Appends the year between the day and the time, e.g. "Dec. 15, 2025, 1:00 p.m." */
  withYear?: boolean;
}

/**
 * AP-style byline time: "Sept. 16, 1:06 p.m." (or "Dec. 15, 2025, 1:00 p.m." with `withYear`).
 * `epochSeconds` is the production schema's `published_at` shape — epoch seconds, not
 * milliseconds and not an ISO string.
 */
export function formatBylineTime(
  epochSeconds: number,
  opts: FormatBylineTimeOptions = {}
): string {
  const { withYear = false } = opts;
  const date = new Date(epochSeconds * 1000);
  const parts = partsFor(date, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const monthNumber = Number(partValue(parts, 'month'));
  const month = AP_MONTHS[monthNumber - 1];
  const day = partValue(parts, 'day');
  const year = partValue(parts, 'year');
  const hour = partValue(parts, 'hour');
  const minute = partValue(parts, 'minute');
  const dayPeriodRaw = partValue(parts, 'dayPeriod').toLowerCase();
  const dayPeriod = dayPeriodRaw.startsWith('a') ? 'a.m.' : 'p.m.';

  const yearSegment = withYear ? `, ${year}` : '';
  return `${month} ${day}${yearSegment}, ${hour}:${minute} ${dayPeriod}`;
}

/** Full dateline: "Wednesday, September 16, 2026". */
export function formatDateline(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const parts = partsFor(date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const weekday = partValue(parts, 'weekday');
  const month = partValue(parts, 'month');
  const day = partValue(parts, 'day');
  const year = partValue(parts, 'year');
  return `${weekday}, ${month} ${day}, ${year}`;
}

/**
 * ISO 8601 with the zone's real UTC offset at that instant (not a fixed "-06:00" or "-07:00" —
 * `Intl`'s `longOffset` resolves DST correctly for the given instant): "2026-09-16T13:06:48-06:00".
 */
export function isoWithOffset(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const parts = partsFor(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset',
  });

  const year = partValue(parts, 'year');
  const month = partValue(parts, 'month');
  const day = partValue(parts, 'day');
  // hour12:false can render midnight as "24" on some ICU builds rather than "00".
  let hour = partValue(parts, 'hour');
  if (hour === '24') hour = '00';
  const minute = partValue(parts, 'minute');
  const second = partValue(parts, 'second');

  const offsetRaw = partValue(parts, 'timeZoneName'); // e.g. "GMT-06:00"
  const offsetMatch = offsetRaw.match(/GMT([+-]\d{2}:\d{2})/);
  const offset = offsetMatch ? offsetMatch[1] : '+00:00';

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}
