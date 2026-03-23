interface EventDateContext {
  eventName?: string;
  eventUrl?: string;
}

function extractYear(text?: string): number | null {
  if (!text) return null;
  const m = text.match(/\b(20\d{2})\b/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  return Number.isNaN(year) ? null : year;
}

function tryParseSlashDate(raw: string): Date | null {
  // Eg: 3/22/26 or 03/22/2026
  // Allow suffixes like ".../26Written By..." by not requiring a strict word boundary.
  const m = raw.match(
    /(?:^|[^0-9])(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?=\D|$)/,
  );
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);

  if (year < 100) {
    // 26 => 2026 (practical for tournament data)
    year = year + (year <= 69 ? 2000 : 1900);
  }

  if (
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  // Use UTC-ish construction (no timezone surprises for date-only).
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function formatEventDate(
  rawDate?: string,
  context: EventDateContext = {},
): string {
  if (!rawDate) return "";

  const cleaned = rawDate
    .replace(/\s*Written By.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  const explicitYear = extractYear(cleaned);
  const inferredYear =
    explicitYear ?? extractYear(context.eventUrl) ?? extractYear(context.eventName);
  const normalizedInput =
    inferredYear && !explicitYear ? `${cleaned} ${inferredYear}` : cleaned;

  const slashDate = tryParseSlashDate(cleaned);
  if (slashDate) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(slashDate);
  }

  // Parse only when year is known to avoid wrong default years.
  if (!inferredYear && !explicitYear) return cleaned;

  const parsed = new Date(normalizedInput);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed);
  }

  return cleaned;
}
