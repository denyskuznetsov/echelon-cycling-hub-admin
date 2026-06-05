import type { UserRole } from "@/src/context/UserContext";

export type NavItem = {
  label: string;
  roles: UserRole[];
  href?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Partners", roles: ["admin", "manager"], href: "/all-partners" },
  { label: "Orders", roles: ["admin", "manager"], href: "/orders" },
  {
    label: "Bike Fits",
    roles: ["admin", "manager"],
    href: "/bike-fits/all-bike-fits",
  },
  { label: "Customers", roles: ["admin", "manager"] },
  {
    label: "Task Management",
    roles: ["admin", "manager", "mechanic"],
    href: "/workshop",
  },
];

export function isPartnersRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/all-partners" ||
    pathname.startsWith("/all-partners/") ||
    pathname === "/partner" ||
    pathname.startsWith("/partner/")
  );
}

/** Strict match for navigation guards and pending-state clearing. */
export function routeMatchesHref(
  pathname: string | null,
  href: string,
): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavItemSelected(
  item: NavItem,
  pathname: string | null,
): boolean {
  if (item.label === "Partners") {
    return isPartnersRoute(pathname);
  }
  return !!item.href && routeMatchesHref(pathname, item.href);
}

export function getVisibleNavItems(role: UserRole | undefined): NavItem[] {
  return role ? NAV_ITEMS.filter((item) => item.roles.includes(role)) : [];
}
