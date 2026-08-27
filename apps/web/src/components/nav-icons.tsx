import type { ReactElement, ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function NavIcon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <NavIcon {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </NavIcon>
  );
}

export function IconProjects(props: IconProps) {
  return (
    <NavIcon {...props}>
      <path d="M4 20V8a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M8 12h8M8 16h5" />
    </NavIcon>
  );
}

export function IconSchedule(props: IconProps) {
  return (
    <NavIcon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4M8 14h3M13 14h3M8 17h3" />
    </NavIcon>
  );
}

export function IconClients(props: IconProps) {
  return (
    <NavIcon {...props}>
      <path d="M3 21V7a2 2 0 0 1 2-2h6v16H5a2 2 0 0 1-2-2Z" />
      <path d="M11 5h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8" />
      <path d="M7 9h2M7 13h2M15 9h2M15 13h2M15 17h2" />
    </NavIcon>
  );
}

export function IconFielders(props: IconProps) {
  return (
    <NavIcon {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5c.8-3.2 2.9-5 5.5-5s4.7 1.8 5.5 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.5 19.5c.5-2.2 1.8-3.5 3.5-3.5.7 0 1.4.2 2 .6" />
    </NavIcon>
  );
}

export function IconInvoices(props: IconProps) {
  return (
    <NavIcon {...props}>
      <path d="M7 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M15 3v5h5M9 13h6M9 17h4" />
    </NavIcon>
  );
}

export function IconFinance(props: IconProps) {
  return (
    <NavIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M15.2 9.2A2.8 2.8 0 0 0 12 7.5c-1.8 0-3 1-3 2.4s1.1 2.2 3 2.6c1.9.4 3 1.2 3 2.6s-1.2 2.4-3 2.4a2.9 2.9 0 0 1-3.2-1.8" />
    </NavIcon>
  );
}

export function IconPayments(props: IconProps) {
  return (
    <NavIcon {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M2.5 10h19M7 15h3" />
    </NavIcon>
  );
}

export function IconReports(props: IconProps) {
  return (
    <NavIcon {...props}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3" />
    </NavIcon>
  );
}

export function IconRates(props: IconProps) {
  return (
    <NavIcon {...props}>
      <path d="M4 15l4-4 3 3 5-6 4 4" />
      <path d="M4 19h16" />
    </NavIcon>
  );
}

export function IconTeam(props: IconProps) {
  return (
    <NavIcon {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5 20c1-3.5 3.5-5.5 7-5.5s6 2 7 5.5" />
      <path d="M19 8.5v3M17.5 10h3" />
    </NavIcon>
  );
}

export const NAV_ICONS: Record<string, (props: IconProps) => ReactElement> = {
  "/dashboard": IconDashboard,
  "/projects": IconProjects,
  "/schedule": IconSchedule,
  "/clients": IconClients,
  "/fielders": IconFielders,
  "/invoices": IconInvoices,
  "/finance": IconFinance,
  "/payments": IconPayments,
  "/reports": IconReports,
  "/rates": IconRates,
  "/team": IconTeam,
};
