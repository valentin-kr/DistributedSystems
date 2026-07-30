const TIMEZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/;

export function parseServerTimestamp(timestamp: string) {
  const normalized = TIMEZONE_SUFFIX_PATTERN.test(timestamp)
    ? timestamp
    : `${timestamp}Z`;

  return new Date(normalized);
}

export function formatEndTime(totalHours: number) {
  if (totalHours <= 0) {
    return "Pick a duration of at least 1 hour";
  }
  const finishAt = new Date(Date.now() + totalHours * 3600 * 1000);
  return `Chat will end on ${finishAt.toLocaleDateString()} at ${finishAt.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  )}`;
}
