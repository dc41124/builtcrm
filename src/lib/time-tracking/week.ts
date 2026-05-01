import { toIsoDate } from "./format";

// Week = Mon → Sun. Returns 7 days starting Monday of the week the input
// falls into. `offset` shifts whole weeks (-1 = last week, 0 = this week).
//
// Computed in the server's local TZ; same caveat as toIsoDate.

export interface WeekDay {
  iso: string;
  label: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  display: string; // "Apr 22"
  isWeekend: boolean;
}

const LABELS: WeekDay["label"][] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function getWeekStart(reference: Date, offset = 0): Date {
  // JS Date.getDay(): Sun=0..Sat=6. Convert to Mon=0..Sun=6.
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0..6 with Mon=0
  d.setDate(d.getDate() - dow + offset * 7);
  return d;
}

export function getWeekEnd(reference: Date, offset = 0): Date {
  const start = getWeekStart(reference, offset);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

export function getWeekDays(reference: Date, offset = 0): WeekDay[] {
  const start = getWeekStart(reference, offset);
  const out: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({
      iso: toIsoDate(d),
      label: LABELS[i],
      display: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      isWeekend: i === 5 || i === 6,
    });
  }
  return out;
}
