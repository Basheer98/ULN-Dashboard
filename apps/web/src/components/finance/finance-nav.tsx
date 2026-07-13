"use client";

import { Header, FinanceSubnav as Subnav } from "@/components/layout";

export { Subnav as FinanceSubnav };

export function FinanceHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <Header title={title} subtitle={subtitle} />
      <Subnav />
    </>
  );
}
