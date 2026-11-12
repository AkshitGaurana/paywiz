/** Today's date in India (YYYY-MM-DD). Used in the system prompt so "tomorrow" works. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function weekdayInIndia(): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long" }).format(
    new Date()
  );
}

/**
 * Returns the ISO string of the start of the current calendar month in Asia/Kolkata timezone.
 * Anchored to the 1st of the month at 00:00:00 IST (+05:30) for accurate database comparisons.
 */
export function startOfCurrentMonthInIndia(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;

  return `${year}-${month}-01T00:00:00+05:30`;
}
