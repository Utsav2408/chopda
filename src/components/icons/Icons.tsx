import type { ReactNode, SVGProps } from "react";
import type { NavIconId } from "@/lib/nav";

type IconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

function IconBase({ title, children, className, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "ui-icon"}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </IconBase>
  );
}

export function IconInvoices(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 3h8a2 2 0 0 1 2 2v14l-3-1.5L12 19l-3-1.5L6 19V5a2 2 0 0 1 2-2Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </IconBase>
  );
}

export function IconFlows(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="6" cy="6" r="2.25" />
      <circle cx="18" cy="12" r="2.25" />
      <circle cx="6" cy="18" r="2.25" />
      <path d="M8.2 7.2 15.8 11.2M8.2 16.8 15.8 12.8" />
    </IconBase>
  );
}

export function IconCompany(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 20V8.5A1.5 1.5 0 0 1 5.5 7H11v13" />
      <path d="M11 20V4.5A1.5 1.5 0 0 1 12.5 3H18.5A1.5 1.5 0 0 1 20 4.5V20" />
      <path d="M7 10.5h1.5M7 14h1.5M14.5 7H16M14.5 10.5H16M14.5 14H16" />
      <path d="M3 20h18" />
    </IconBase>
  );
}

export function IconProfile(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </IconBase>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 19a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.2 19a5 5 0 0 1 6.3 0" />
    </IconBase>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.5M17.5 16l1.6 1.5M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.5M17.5 8l1.6-1.5" />
    </IconBase>
  );
}

export function IconLock(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5.5" y="11" width="13" height="9.5" rx="1.5" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </IconBase>
  );
}

export function IconPrefs(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />
      <circle cx="9" cy="7" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="11" cy="17" r="1.75" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function IconBell(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.5 16.5h11l-1.1-1.6a2 2 0 0 1-.3-1.1V10a4.1 4.1 0 1 0-8.2 0v3.8c0 .4-.1.8-.3 1.1L6.5 16.5Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </IconBase>
  );
}

export function IconSignOut(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 4.5H7.5A2 2 0 0 0 5.5 6.5v11a2 2 0 0 0 2 2H10" />
      <path d="M13 12h7.5M17.5 8.5 21 12l-3.5 3.5" />
    </IconBase>
  );
}

export function IconPanelLeft(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9.5 4.5v15" />
    </IconBase>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14.5 6.5 9.5 12l5 5.5" />
    </IconBase>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9.5 6.5 14.5 12l-5 5.5" />
    </IconBase>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />
    </IconBase>
  );
}

export function IconClose(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    </IconBase>
  );
}

export function IconMoreVertical(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="5.5" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.25" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

const NAV_ICONS = {
  dashboard: IconDashboard,
  invoices: IconInvoices,
  flows: IconFlows,
  users: IconUsers,
} as const;

export function NavIcon({ id, ...props }: IconProps & { id: NavIconId }) {
  const Cmp = NAV_ICONS[id];
  return <Cmp {...props} />;
}
