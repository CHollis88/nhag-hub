const MAX_OCCURRENCES = 26; // ~6 months weekly -- a sane cap against runaway data generation

const INTERVAL_DAYS = { weekly: 7, biweekly: 14 };

// Returns an array of date strings (YYYY-MM-DD), starting with the given
// date itself. repeat is one of "weekly" | "biweekly" | "monthly" | falsy
// (no repeat -- just the single date back). count is how many total
// occurrences to generate, capped at MAX_OCCURRENCES.
export function generateOccurrenceDates(startDate, repeat, count) {
  if (!repeat) return [startDate];

  const total = Math.max(1, Math.min(Number(count) || 1, MAX_OCCURRENCES));
  const dates = [];
  const [y, m, d] = startDate.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));

  for (let i = 0; i < total; i++) {
    let next;
    if (repeat === "monthly") {
      // Naively calling setUTCMonth() overflows into the next month when
      // the target month is shorter (e.g. Jan 31 + 1 month becomes "Feb
      // 31", which JS silently normalizes to Mar 3) -- clamp the day to
      // the target month's actual last day instead.
      const targetMonthIndex = base.getUTCMonth() + i;
      const daysInTargetMonth = new Date(Date.UTC(y, targetMonthIndex + 1, 0)).getUTCDate();
      const clampedDay = Math.min(d, daysInTargetMonth);
      next = new Date(Date.UTC(y, targetMonthIndex, clampedDay));
    } else {
      const days = INTERVAL_DAYS[repeat];
      if (!days) return [startDate]; // unrecognized repeat value -- fail safe to a single event
      next = new Date(base);
      next.setUTCDate(base.getUTCDate() + days * i);
    }
    dates.push(next.toISOString().slice(0, 10));
  }
  return dates;
}
