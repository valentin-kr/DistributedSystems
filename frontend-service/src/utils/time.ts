const TIMEZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/;

export function parseServerTimestamp(timestamp: string) {
  const normalized = TIMEZONE_SUFFIX_PATTERN.test(timestamp)
    ? timestamp
    : `${timestamp}Z`;

  return new Date(normalized);
}
