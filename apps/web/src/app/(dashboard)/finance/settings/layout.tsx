import { requirePageAccess } from "@/lib/page-guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("/finance/settings");
  return children;
}
