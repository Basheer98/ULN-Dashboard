export type DateRangePreset = "month" | "quarter" | "year" | "all" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  preset: DateRangePreset;
}

export function resolveDateRange(
  preset: DateRangePreset,
  fromStr?: string | null,
  toStr?: string | null
): DateRange {
  const now = new Date();
  const to = toStr ? endOfDay(new Date(toStr)) : endOfDay(now);

  if (preset === "custom" && fromStr) {
    return { from: startOfDay(new Date(fromStr)), to, preset };
  }

  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1);
    return { from: startOfDay(from), to, preset };
  }

  if (preset === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: startOfDay(from), to, preset };
  }

  if (preset === "all") {
    return { from: new Date(2000, 0, 1), to, preset };
  }

  // default: this month
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: startOfDay(from), to, preset: preset === "custom" ? "month" : preset };
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function inDateRange(date: Date, range: DateRange): boolean {
  const t = date.getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

export function parseDateRangeParams(searchParams: URLSearchParams): DateRange {
  const preset = (searchParams.get("preset") ?? "month") as DateRangePreset;
  return resolveDateRange(preset, searchParams.get("from"), searchParams.get("to"));
}
