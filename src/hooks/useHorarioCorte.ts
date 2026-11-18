import { useEffect, useMemo, useState } from "react";

export const LIMA_TIME_ZONE = "America/Lima";
export const CORTE_MINUTES = 16 * 60 + 30;
export const INICIO_ATENCION_MINUTES = 8 * 60;
export const INICIO_ULTIMOS_MINUTOS = 16 * 60 + 15;
const SERVER_CLOCK_SYNC_INTERVAL_MS = 60_000;
const CLOCK_TICK_INTERVAL_MS = 1_000;

export type ServerTimeProvider = () => Promise<Date | null>;

export interface HorarioCorteResult {
  technicalTimestamp: string;
  legalTimestamp: string;
  isNonBusinessDay: boolean;
  isAfterCutoff: boolean;
  requiresProjection: boolean;
  legalDate: string;
  isHorarioHabil: boolean;
  isUltimosMinutos: boolean;
  isExtemporaneo: boolean;
  fechaJuridicaRecepcion: string;
  serverTime: Date;
}

interface LimaParts {
  date: string;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const limaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LIMA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
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
    second: Number(parts.second),
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
  const minutesOfDay = parts.hour * 60 + parts.minute;
  const secondsOfDay = minutesOfDay * 60 + parts.second;
  const isAfterCutoff = minutesOfDay >= CORTE_MINUTES;
  const requiresProjection = isNonBusinessDay || isAfterCutoff;
  const legalDate = requiresProjection
    ? getNextBusinessDate(parts.date, holidaySet)
    : parts.date;
  const isHorarioHabil =
    !isNonBusinessDay &&
    minutesOfDay >= INICIO_ATENCION_MINUTES &&
    minutesOfDay < CORTE_MINUTES;
  const isUltimosMinutos =
    isHorarioHabil &&
    secondsOfDay >= INICIO_ULTIMOS_MINUTOS * 60 &&
    secondsOfDay < CORTE_MINUTES * 60;
  const legalTimestamp = `${legalDate}T08:00:00-05:00`;

  return {
    technicalTimestamp: now.toISOString(),
    legalTimestamp,
    isNonBusinessDay,
    isAfterCutoff,
    requiresProjection,
    legalDate,
    isHorarioHabil,
    isUltimosMinutos,
    isExtemporaneo: requiresProjection,
    fechaJuridicaRecepcion: legalTimestamp,
    serverTime: now,
  };
}

export function formatFechaJuridicaRecepcion(timestamp: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TIME_ZONE,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

async function fetchServerTime(): Promise<Date | null> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!apiBaseUrl || typeof fetch === "undefined") return null;

  const response = await fetch(apiBaseUrl, { method: "HEAD", cache: "no-store" });
  const dateHeader = response.headers.get("Date");
  if (!dateHeader) return null;

  const serverTime = new Date(dateHeader);
  return Number.isNaN(serverTime.getTime()) ? null : serverTime;
}

export function useHorarioCorte(
  now?: Date,
  holidays: readonly string[] = [],
  serverTimeProvider: ServerTimeProvider = fetchServerTime,
) {
  const [clientTime, setClientTime] = useState(() => now ?? new Date());
  const [serverOffsetMs, setServerOffsetMs] = useState<number | null>(null);
  const [clockSyncFailed, setClockSyncFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const synchronizeClock = async () => {
      const requestStartedAt = Date.now();
      try {
        const timestamp = await serverTimeProvider();
        const responseReceivedAt = Date.now();
        if (isMounted && timestamp) {
          const requestMidpoint = (requestStartedAt + responseReceivedAt) / 2;
          setServerOffsetMs(timestamp.getTime() - requestMidpoint);
          setClockSyncFailed(false);
        } else if (isMounted) {
          setClockSyncFailed(true);
        }
      } catch {
        if (isMounted) setClockSyncFailed(true);
      }
    };

    void synchronizeClock();
    const clockInterval = window.setInterval(
      () => setClientTime(new Date()),
      CLOCK_TICK_INTERVAL_MS,
    );
    const syncInterval = window.setInterval(
      () => void synchronizeClock(),
      SERVER_CLOCK_SYNC_INTERVAL_MS,
    );

    return () => {
      isMounted = false;
      window.clearInterval(clockInterval);
      window.clearInterval(syncInterval);
    };
  }, [serverTimeProvider]);

  const serverTime = useMemo(
    () => new Date(clientTime.getTime() + (serverOffsetMs ?? 0)),
    [clientTime, serverOffsetMs],
  );

  return useMemo(
    () => ({
      ...calculateHorarioCorte(serverTime, holidays),
      isClockSynchronized: serverOffsetMs !== null || now !== undefined,
      isClockSyncUnavailable: clockSyncFailed && serverOffsetMs === null && now === undefined,
    }),
    [serverTime, holidays, serverOffsetMs, clockSyncFailed, now],
  );
}
