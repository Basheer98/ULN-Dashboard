import { requirePageAccess } from "@/lib/page-guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("/projects/import");
  return children;
}
