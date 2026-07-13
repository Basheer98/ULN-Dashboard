export function getEcdLabel(dueDate: string | null | undefined): {
  text: string;
  urgent: boolean;
  overdue: boolean;
} | null {
  if (!dueDate) return null;

  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)}d overdue`,
      urgent: true,
      overdue: true,
    };
  }
  if (diffDays === 0) return { text: "Due today", urgent: true, overdue: false };
  if (diffDays === 1) return { text: "Due tomorrow", urgent: true, overdue: false };
  return {
    text: `Due in ${diffDays}d`,
    urgent: diffDays <= 3,
    overdue: false,
  };
}
