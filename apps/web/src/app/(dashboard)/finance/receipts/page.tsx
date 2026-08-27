import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { ReceiptVerifyActions } from "@/components/finance/receipt-actions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { fielderFolderLabel } from "@/lib/receipt-naming";

function receiptFileUrl(storedFileName: string) {
  return `/api/v1/finance/receipts/file/${storedFileName
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter =
    params.status && ["pending", "verified", "rejected"].includes(params.status)
      ? (params.status as "pending" | "verified" | "rejected")
      : undefined;

  const receipts = await prisma.receipt.findMany({
    where: {
      deletedAt: null,
      ...(statusFilter ? { verificationStatus: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      transaction: {
        select: {
          id: true,
          transactionNumber: true,
          description: true,
          amount: true,
          transactionDate: true,
          project: { select: { projectNumber: true } },
          fielder: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
  });

  const pendingCount = statusFilter
    ? 0
    : await prisma.receipt.count({
        where: { deletedAt: null, verificationStatus: "pending" },
      });

  const grouped = new Map<string, typeof receipts>();
  for (const receipt of receipts) {
    const fielder = receipt.transaction?.fielder;
    const key = fielder ? `fielder-${fielder.id}` : "company";
    const label = fielderFolderLabel(fielder?.firstName, fielder?.lastName, fielder?.id);
    const groupKey = `${key}::${label}`;
    if (!grouped.has(groupKey)) grouped.set(groupKey, []);
    grouped.get(groupKey)!.push(receipt);
  }

  return (
    <>
      <FinanceHeader
        title="Receipts"
        subtitle="Organized by fielder folder with readable receipt names"
      />
      <main className="page-main space-y-6">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/finance/receipts"
            className={!statusFilter ? "btn-primary text-xs" : "btn-ghost text-xs"}
          >
            All
          </Link>
          <Link
            href="/finance/receipts?status=pending"
            className={statusFilter === "pending" ? "btn-primary text-xs" : "btn-ghost text-xs"}
          >
            Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Link>
          <Link
            href="/finance/receipts?status=verified"
            className={statusFilter === "verified" ? "btn-primary text-xs" : "btn-ghost text-xs"}
          >
            Verified
          </Link>
          <Link
            href="/finance/receipts?status=rejected"
            className={statusFilter === "rejected" ? "btn-primary text-xs" : "btn-ghost text-xs"}
          >
            Rejected
          </Link>
        </div>

        {receipts.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">
            No receipts{statusFilter ? ` with status "${statusFilter}"` : " uploaded yet"}.
          </div>
        ) : (
          Array.from(grouped.entries()).map(([groupKey, items]) => {
            const label = groupKey.split("::")[1] ?? "Receipts";
            return (
              <section key={groupKey} className="card">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{label}</h2>
                    <p className="text-sm text-muted-foreground">
                      {items.length} receipt{items.length === 1 ? "" : "s"} · folder{" "}
                      <code className="rounded bg-surface-elevated px-1.5 py-0.5 text-xs">
                        receipts/{items[0]?.storedFileName.split("/")[1] ?? "company"}
                      </code>
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Receipt</th>
                        <th>Project</th>
                        <th>Amount</th>
                        <th>Expense</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th></th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <div className="font-medium text-foreground">{r.originalFileName}</div>
                            <div className="text-xs text-muted-foreground">{r.storedFileName}</div>
                          </td>
                          <td>{r.transaction?.project?.projectNumber ?? "—"}</td>
                          <td>
                            {r.transaction
                              ? `$${Number(r.transaction.amount).toFixed(2)}`
                              : "—"}
                          </td>
                          <td>
                            {r.transaction ? (
                              <Link href={`/finance/expenses/${r.transaction.id}`} className="link">
                                {r.transaction.transactionNumber}
                              </Link>
                            ) : (
                              "Unlinked"
                            )}
                          </td>
                          <td>
                            <StatusBadge status={r.verificationStatus} />
                          </td>
                          <td>
                            {(r.transaction?.transactionDate ?? r.createdAt).toLocaleDateString()}
                          </td>
                          <td>
                            <a
                              href={receiptFileUrl(r.storedFileName)}
                              className="link text-sm"
                              target="_blank"
                              rel="noreferrer"
                            >
                              View
                            </a>
                          </td>
                          <td>
                            <ReceiptVerifyActions receiptId={r.id} status={r.verificationStatus} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        )}
      </main>
    </>
  );
}
