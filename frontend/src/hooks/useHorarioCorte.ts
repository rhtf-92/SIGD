import { useEffect, useMemo, useState } from "react";

export const LIMA_TIME_ZONE = "America/Lima";
export const CORTE_MINUTES = 16 * 60 + 30;

export interface HorarioCorteResult {
  technicalTimestamp: string;
  legalTimestamp: string;
  isNonBusinessDay: boolean;
  isAfterCutoff: boolean;
  requiresProjection: boolean;
  legalDate: string;
}

interface LimaParts {
  date: string;
  hour: number;
  minute: number;
  weekday: number;
}

const limaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LIMA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

function getLimaParts(date: Date): LimaParts {
  const parts = Object.fromEntries(
    limaFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  const weekday = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(
    parts.weekday.toLowerCase(),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday,
  };
}

function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isBusinessDate(date: string, holidays: ReadonlySet<string>): boolean {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !holidays.has(date);
}

export function getNextBusinessDate(
  date: string,
  holidays: ReadonlySet<string>,
): string {
  let candidate = addCalendarDays(date, 1);
  while (!isBusinessDate(candidate, holidays)) {
    candidate = addCalendarDays(candidate, 1);
  }
  return candidate;
}

export function calculateHorarioCorte(
  now: Date,
  holidays: readonly string[] = [],
): HorarioCorteResult {
  const parts = getLimaParts(now);
  const holidaySet = new Set(holidays);
  const isNonBusinessDay =
    parts.weekday === 0 || parts.weekday === 6 || holidaySet.has(parts.date);
  const isAfterCutoff =
    parts.hour * 60 + parts.minute >= CORTE_MINUTES;
  const requiresProjection = isNonBusinessDay || isAfterCutoff;
  const legalDate = requiresProjection
    ? getNextBusinessDate(parts.date, holidaySet)
    : parts.date;

  return {
    technicalTimestamp: now.toISOString(),
    legalTimestamp: `${legalDate}T08:00:00-05:00`,
    isNonBusinessDay,
    isAfterCutoff,
    requiresProjection,
    legalDate,
  };
}

export function useHorarioCorte(
  now: Date = new Date(),
  holidays: readonly string[] = [],
) {
  const [currentTime, setCurrentTime] = useState(now);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return useMemo(
    () => calculateHorarioCorte(currentTime, holidays),
    [currentTime, holidays],
  );
}
