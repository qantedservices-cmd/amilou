/**
 * Week utilities using Sun-Sat week system
 *
 * IMPORTANT: This app uses a Sunday-Saturday week system, NOT ISO weeks (Mon-Sun).
 * - Week starts on Sunday
 * - Week ends on Saturday
 * - Week 1 is the first week containing January 1st
 */

/**
 * Get the week number for a date using Sun-Sat system
 * @param date The date to get the week number for
 * @returns Week number (1-53)
 */
export function getWeekNumber(date: Date): number {
  // Create a copy to avoid mutating the original
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);

  // Get the Sunday that starts this week (Sun-Sat system)
  const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dayOfWeek);

  // Get January 1st of the year
  const jan1 = new Date(sunday.getFullYear(), 0, 1);

  // Get the Sunday of the week containing January 1st
  const jan1DayOfWeek = jan1.getDay();
  const jan1Sunday = new Date(jan1);
  jan1Sunday.setDate(jan1.getDate() - jan1DayOfWeek);

  // Calculate the number of weeks between
  const diffTime = sunday.getTime() - jan1Sunday.getTime();
  const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));

  return diffWeeks + 1;
}

/**
 * Get the Sunday that starts a given week (Sun-Sat system)
 * @param year The year
 * @param week The week number (1-53)
 * @returns Date of the Sunday that starts this week
 */
export function getSundayOfWeek(year: number, week: number): Date {
  // Get January 1st of the year
  const jan1 = new Date(Date.UTC(year, 0, 1));

  // Get the Sunday of week 1 (the Sunday on or before January 1st)
  const jan1DayOfWeek = jan1.getUTCDay(); // 0 = Sunday
  const week1Sunday = new Date(jan1);
  week1Sunday.setUTCDate(jan1.getUTCDate() - jan1DayOfWeek);

  // Add the appropriate number of weeks
  const targetSunday = new Date(week1Sunday);
  targetSunday.setUTCDate(week1Sunday.getUTCDate() + (week - 1) * 7);

  // Return at midnight UTC
  return new Date(Date.UTC(
    targetSunday.getUTCFullYear(),
    targetSunday.getUTCMonth(),
    targetSunday.getUTCDate()
  ));
}

/**
 * Get the year and week number for a date
 * Handles year boundary correctly (e.g., Dec 31 might be week 1 of next year)
 */
export function getYearAndWeek(date: Date): { year: number; week: number } {
  const week = getWeekNumber(date);
  const year = date.getFullYear();

  // If we're in early January but the week started in December
  if (date.getMonth() === 0 && week > 50) {
    return { year: year - 1, week };
  }

  // If we're in late December but the week belongs to next year
  if (date.getMonth() === 11 && week === 1) {
    return { year: year + 1, week };
  }

  return { year, week };
}
