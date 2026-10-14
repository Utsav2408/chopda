import Link from "next/link";

type ProfileTabsProps = {
  active: "me" | "company";
};

/** Shared header tabs between /profile and /company (wireframes screens 8–9). */
export function ProfileTabs({ active }: ProfileTabsProps) {
  return (
    <nav className="profile-tabs" aria-label="Profile sections">
      <Link
        href="/profile"
        className="profile-tabs__link"
        aria-current={active === "me" ? "page" : undefined}
      >
        My profile
      </Link>
      <Link
        href="/company"
        className="profile-tabs__link"
        aria-current={active === "company" ? "page" : undefined}
      >
        Company profile
      </Link>
    </nav>
  );
}
