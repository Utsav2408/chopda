import { redirect } from "next/navigation";

/** Password moved under Privacy — keep old URL working. */
export default function ProfilePasswordRedirectPage() {
  redirect("/profile/privacy");
}
