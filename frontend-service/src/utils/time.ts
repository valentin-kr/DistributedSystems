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

export function formatLastActiveTime(timestamp?: string | null) {
  if (!timestamp) {
    return "Last active: no activity yet";
  }

  const lastActive = parseServerTimestamp(timestamp);
  if (Number.isNaN(lastActive.getTime())) {
    return "Last active: unknown";
  }

  const time = lastActive.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (Date.now() - lastActive.getTime() < 24 * 60 * 60 * 1000) {
    return `Last active: ${time}`;
  }

  const date = lastActive.toLocaleDateString([], {
    day: "2-digit",
    month: "2-digit",
  });
  return `Last active: ${date} ${time}`;
}
