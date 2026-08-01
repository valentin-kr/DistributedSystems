const TIMEZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/;
const ROOM_ONLINE_WINDOW_MS = 45_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

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

function formatCompactDuration(durationMs: number) {
  const safeDuration = Math.max(0, durationMs);

  if (safeDuration < MINUTE_MS) {
    return "<1m";
  }

  if (safeDuration < HOUR_MS) {
    return `${Math.ceil(safeDuration / MINUTE_MS)}m`;
  }

  if (safeDuration < DAY_MS) {
    return `${Math.ceil(safeDuration / HOUR_MS)}h`;
  }

  return `${Math.ceil(safeDuration / DAY_MS)}d`;
}

export function formatRoomExpiryStatus(
  expiryDate: string,
  active: boolean,
  nowMs = Date.now(),
) {
  const expiry = parseServerTimestamp(expiryDate);

  if (Number.isNaN(expiry.getTime())) {
    return {
      label: active ? "Active" : "Expired",
      title: "Expiry time unknown",
    };
  }

  const expiryTime = expiry.getTime();
  const exactTime = expiry.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (active) {
    return {
      label: `Active · ${formatCompactDuration(expiryTime - nowMs)} left`,
      title: `Expires ${exactTime}`,
    };
  }

  return {
    label: `Expired · ended ${formatCompactDuration(nowMs - expiryTime)} ago`,
    title: `Expired ${exactTime}`,
  };
}

export function formatLastActiveTime(timestamp?: string | null) {
  if (!timestamp) {
    return "Last seen: no activity yet";
  }

  const lastActive = parseServerTimestamp(timestamp);
  if (Number.isNaN(lastActive.getTime())) {
    return "Last seen: unknown";
  }

  const time = lastActive.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (Date.now() - lastActive.getTime() < 24 * 60 * 60 * 1000) {
    return `Last seen: ${time}`;
  }

  const date = lastActive.toLocaleDateString([], {
    day: "2-digit",
    month: "2-digit",
  });
  return `Last seen: ${date} ${time}`;
}

export function isRoomPresenceOnline(timestamp?: string | null) {
  if (!timestamp) return false;
  const lastSeen = parseServerTimestamp(timestamp).getTime();
  return (
    !Number.isNaN(lastSeen) && Date.now() - lastSeen <= ROOM_ONLINE_WINDOW_MS
  );
}
