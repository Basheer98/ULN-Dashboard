import { requirePageAccess } from "@/lib/page-guard";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("/finance");
  return <div className="flex min-w-0 flex-1 flex-col">{children}</div>;
}
