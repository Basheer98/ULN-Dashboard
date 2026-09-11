import { toNumber } from "@uln/shared";

/** Weekly chart for cash actually received (amountPaid), not full owed. */
export function buildWeeklyEarnings(
  payments: {
    paidAt: Date | null;
    totalAmount: unknown;
    amountPaid?: unknown;
    status: string;
  }[]
) {
  const paid = payments.filter(
    (p) => (p.status === "paid" || p.status === "partial") && p.paidAt && toNumber(p.amountPaid ?? 0) > 0
  );
  const weeks: { label: string; amount: number; weekStart: string }[] = [];
  const today = new Date();

  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(today);
    weekEnd.setHours(23, 59, 59, 999);
    weekEnd.setDate(today.getDate() - i * 7);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekEndStart = new Date(weekStart);
    weekEndStart.setDate(weekStart.getDate() + 6);
    weekEndStart.setHours(23, 59, 59, 999);

    const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const amount = paid
      .filter((p) => {
        const d = new Date(p.paidAt!);
        return d >= weekStart && d <= weekEndStart;
      })
      .reduce((s, p) => s + toNumber(p.amountPaid ?? p.totalAmount), 0);

    weeks.push({
      label,
      amount: Math.round(amount * 100) / 100,
      weekStart: weekStart.toISOString().slice(0, 10),
    });
  }

  return weeks;
}
