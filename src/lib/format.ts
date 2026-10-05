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

// 06-05 (Task 2): Spanish byline/dateline strings, built from FIXED arrays — never
// `Intl.DateTimeFormat(..., { locale: 'es-...' })` month/weekday names, which depend on the host's
// installed ICU data and can change between Node versions (same byte-identity reasoning that
// drives AP_MONTHS above). Every Spanish month abbreviation carries a trailing period, including
// the ones English spells out in full (`may.`, `jun.`, `jul.`) — Spanish AP style abbreviates all
// twelve.
const ES_MONTHS_ABBR = [
  'ene.',
  'feb.',
  'mar.',
  'abr.',
  'may.',
  'jun.',
  'jul.',
  'ago.',
  'sept.',
  'oct.',
  'nov.',
  'dic.',
] as const;

const ES_MONTHS_FULL = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

// English short weekday names (`Sun`..`Sat`) are used ONLY as a stable numeric key to look up the
// Spanish weekday name below — not rendered. English short weekday spelling is guaranteed by the
// Gregorian calendar + `en-US` locale and does not vary across Node/ICU versions the way a
// Spanish name would if fetched the same way.
const EN_WEEKDAY_SHORT_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const ES_WEEKDAYS_FULL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

function partsFor(date: Date, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, ...options }).formatToParts(date);
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

export interface FormatBylineTimeOptions {
  /** Appends the year between the day and the time, e.g. "Dec. 15, 2025, 1:00 p.m." */
  withYear?: boolean;
  /** 06-05 (Task 2): renders the fixed Spanish byline shape instead of English AP style.
   * Defaults to `'en'` — every pre-06-05 call site renders byte-identically to before. */
  language?: 'en' | 'es';
}

/**
 * AP-style byline time: "Sept. 16, 1:06 p.m." (or "Dec. 15, 2025, 1:00 p.m." with `withYear`);
 * with `language: 'es'`, the fixed Spanish shape: "16 sept., 1:06 p. m." (or
 * "15 dic. 2025, 1:00 p. m." with `withYear`) — day before month, `a. m.`/`p. m.` with spaces.
 * `epochSeconds` is the production schema's `published_at` shape — epoch seconds, not
 * milliseconds and not an ISO string.
 */
export function formatBylineTime(
  epochSeconds: number,
  opts: FormatBylineTimeOptions = {}
): string {
  const { withYear = false, language = 'en' } = opts;
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
  const day = partValue(parts, 'day');
  const year = partValue(parts, 'year');
  const hour = partValue(parts, 'hour');
  const minute = partValue(parts, 'minute');
  const dayPeriodRaw = partValue(parts, 'dayPeriod').toLowerCase();
  const isAm = dayPeriodRaw.startsWith('a');

  if (language === 'es') {
    const month = ES_MONTHS_ABBR[monthNumber - 1];
    const dayPeriod = isAm ? 'a. m.' : 'p. m.';
    const yearSegment = withYear ? ` ${year}` : '';
    return `${day} ${month}${yearSegment}, ${hour}:${minute} ${dayPeriod}`;
  }

  const month = AP_MONTHS[monthNumber - 1];
  const dayPeriod = isAm ? 'a.m.' : 'p.m.';
  const yearSegment = withYear ? `, ${year}` : '';
  return `${month} ${day}${yearSegment}, ${hour}:${minute} ${dayPeriod}`;
}

/** Full dateline: "Wednesday, September 16, 2026"; with `language: 'es'`, the fixed lowercase
 * Spanish shape "miércoles, 16 de septiembre de 2026". Defaults to `'en'` — every pre-06-05 call
 * site renders byte-identically to before. */
export function formatDateline(epochSeconds: number, language: 'en' | 'es' = 'en'): string {
  const date = new Date(epochSeconds * 1000);

  if (language === 'es') {
    // Fetched as numeric/short (not 'long') specifically so the Spanish name comes from the
    // fixed ES_* arrays above, never from Intl's own (ICU-version-dependent) locale strings.
    const parts = partsFor(date, {
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
    const weekdayShort = partValue(parts, 'weekday');
    const weekdayIndex = EN_WEEKDAY_SHORT_ORDER.indexOf(
      weekdayShort as (typeof EN_WEEKDAY_SHORT_ORDER)[number]
    );
    if (weekdayIndex === -1) {
      throw new Error(`format: unrecognized weekday abbreviation: ${JSON.stringify(weekdayShort)}`);
    }
    const monthNumber = Number(partValue(parts, 'month'));
    const day = partValue(parts, 'day');
    const year = partValue(parts, 'year');
    const weekday = ES_WEEKDAYS_FULL[weekdayIndex];
    const month = ES_MONTHS_FULL[monthNumber - 1];
    return `${weekday}, ${day} de ${month} de ${year}`;
  }

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
