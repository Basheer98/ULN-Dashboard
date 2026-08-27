import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { MileageActions } from "@/components/finance/finance-actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { mileagePhotoInclude } from "@/lib/mileage";

function photoUrl(storedFileName: string) {
  return `/api/v1/finance/mileage/photos/file/${storedFileName
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export default async function MileageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await prisma.mileageEntry.findUnique({
    where: { id },
    include: {
      driver: true,
      vehicle: true,
      trip: true,
      ...mileagePhotoInclude,
    },
  });
  if (!entry) notFound();

  const startPhoto = entry.photos.find((p) => p.kind === "start_odometer");
  const endPhoto = entry.photos.find((p) => p.kind === "end_odometer");

  return (
    <>
      <FinanceHeader
        title="Mileage Detail"
        subtitle={`${entry.driver.firstName} ${entry.driver.lastName} · ${entry.date.toLocaleDateString()}`}
      />
      <main className="page-main space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/finance/mileage" className="link text-sm">
            ← Back to mileage
          </Link>
          <MileageActions mileageId={entry.id} status={entry.status} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card space-y-3">
            <h2 className="font-semibold text-foreground">Trip</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={entry.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Route</dt>
                <dd className="text-right">
                  {[entry.startLocation, entry.destination].filter(Boolean).join(" → ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Start odometer</dt>
                <dd>
                  {entry.startOdometer != null ? toNumber(entry.startOdometer).toFixed(1) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">End odometer</dt>
                <dd>
                  {entry.endOdometer != null ? toNumber(entry.endOdometer).toFixed(1) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Miles</dt>
                <dd className="font-medium">{toNumber(entry.totalMiles).toFixed(1)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Reimbursement</dt>
                <dd className="font-medium">
                  {formatCurrency(toNumber(entry.reimbursement))}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Purpose</dt>
                <dd className="text-right">{entry.businessPurpose || "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-foreground">Odometer proof</h2>
            <p className="text-sm text-muted-foreground">
              Verify the reading in each photo matches the numbers above before approving.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">Start</h3>
                {startPhoto ? (
                  <a
                    href={photoUrl(startPhoto.storedFileName)}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl(startPhoto.storedFileName)}
                      alt="Start odometer"
                      className="h-48 w-full object-cover"
                    />
                  </a>
                ) : (
                  <p className="text-sm text-danger">Missing start photo</p>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">End</h3>
                {endPhoto ? (
                  <a
                    href={photoUrl(endPhoto.storedFileName)}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl(endPhoto.storedFileName)}
                      alt="End odometer"
                      className="h-48 w-full object-cover"
                    />
                  </a>
                ) : (
                  <p className="text-sm text-danger">Missing end photo</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
