import { NextRequest } from "next/server";
import { parseDateRangeParams } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, requirePermission } from "@/lib/api";
import { getDashboardAnalytics } from "@/lib/analytics";
import { projectsExportCsv, paymentsExportCsv } from "@/lib/export";
import { generateReportPdf } from "@/lib/pdf";
import { inDateRange } from "@uln/shared";

export async function GET(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "reports:export");
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") ?? "csv";
    const report = searchParams.get("report") ?? "projects";
    const range = parseDateRangeParams(searchParams);

    if (report === "payments") {
      const payments = await prisma.fielderPayment.findMany({
        include: { fielder: true, project: true },
        orderBy: { createdAt: "desc" },
      });
      const filtered = payments.filter((p) => inDateRange(new Date(p.createdAt), range));
      const csv = paymentsExportCsv(filtered);
      if (type === "pdf") {
        const pdf = generateReportPdf(
          "Fielder Payments Report",
          filtered.map((p) => [
            `${p.fielder.firstName} ${p.fielder.lastName}`,
            p.fielder.employmentType === "w2" ? "W-2" : "1099",
            p.project?.projectNumber ?? "",
            String(Number(p.totalAmount)),
            p.status,
          ]),
          ["Fielder", "Type", "Project", "Amount", "Status"]
        );
        return new Response(new Uint8Array(pdf), {
          headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="payments-report.pdf"' },
        });
      }
      return new Response(csv, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="payments-report.csv"' },
      });
    }

    const projects = await prisma.project.findMany({
      include: { client: true },
      orderBy: { createdAt: "desc" },
    });
    const stateParam = searchParams.get("state");
    const filtered = projects.filter(
      (p) =>
        inDateRange(new Date(p.completedAt ?? p.createdAt), range) &&
        (!stateParam || p.state === stateParam)
    );

    if (type === "pdf") {
      const analytics = await getDashboardAnalytics(range, { state: stateParam ?? undefined });
      const pdf = generateReportPdf(
        "ULN Operations Report",
        analytics.topFielders.map((f) => [f.name, String(f.jobs), String(f.sqft)]),
        ["Fielder", "Jobs", "SQFT"]
      );
      return new Response(new Uint8Array(pdf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="uln-report.pdf"' },
      });
    }

    const csv = projectsExportCsv(filtered);
    return new Response(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="projects-report.csv"' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
