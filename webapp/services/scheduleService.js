const DEFAULT_SCHEDULE = [
  {
    days: [1, 2, 3, 4, 5, 6, 0],
    intervals: [{ start: "10:00", end: "22:00" }],
  },
];

function parseTimeToMinutes(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function normalizeSchedule(rawSchedule, fallbackHours) {
  if (Array.isArray(rawSchedule) && rawSchedule.length) return rawSchedule;
  if (fallbackHours?.open || fallbackHours?.close) {
    const open = fallbackHours?.open || "10:00";
    const close = fallbackHours?.close || "22:00";
    return [
      {
        days: [1, 2, 3, 4, 5, 6, 0],
        intervals: [{ start: open, end: close }],
      },
    ];
  }
  return DEFAULT_SCHEDULE;
}

function getIntervalsForDay(schedule, day) {
  return schedule
    .filter((entry) => Array.isArray(entry?.days) && entry.days.includes(day))
    .flatMap((entry) => entry.intervals || [])
    .map((interval) => {
      const start = parseTimeToMinutes(interval?.start);
      const end = parseTimeToMinutes(interval?.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      return { start, end };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

export function getScheduleStatus(rawSchedule, fallbackHours, now = new Date()) {
  const schedule = normalizeSchedule(rawSchedule, fallbackHours);
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const intervals = getIntervalsForDay(schedule, day);
  const activeInterval = intervals.find((interval) => minutes >= interval.start && minutes <= interval.end);
  const isOpen = Boolean(activeInterval);
  let nextOpen = null;

  if (isOpen) {
    nextOpen = new Date(now);
  } else {
    for (let offset = 0; offset < 7 && !nextOpen; offset += 1) {
      const candidateDate = new Date(now);
      candidateDate.setDate(now.getDate() + offset);
      const candidateDay = candidateDate.getDay();
      const candidateIntervals = getIntervalsForDay(schedule, candidateDay);
      const candidateMinutes = offset === 0 ? minutes : 0;
      const candidate = candidateIntervals.find((interval) => interval.start >= candidateMinutes);
      if (candidate) {
        const hours = Math.floor(candidate.start / 60);
        const mins = candidate.start % 60;
        candidateDate.setHours(hours, mins, 0, 0);
        nextOpen = candidateDate;
      }
    }
  }

  return { isOpen, nextOpen, intervals, schedule };
}

export function getUpcomingSlots(rawSchedule, fallbackHours, now = new Date(), daysAhead = 5) {
  const schedule = normalizeSchedule(rawSchedule, fallbackHours);
  const slots = [];
  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() + offset);
    const day = dayDate.getDay();
    const intervals = getIntervalsForDay(schedule, day);
    intervals.forEach((interval) => {
      const minutesNow = offset === 0 ? now.getHours() * 60 + now.getMinutes() : 0;
      if (interval.end <= minutesNow) return;
      const slotDate = new Date(dayDate);
      slotDate.setHours(Math.floor(interval.start / 60), interval.start % 60, 0, 0);
      slots.push(slotDate);
    });
  }
  if (!slots.length) {
    const fallback = new Date(now);
    fallback.setHours(10, 0, 0, 0);
    slots.push(fallback);
  }
  return slots;
}
