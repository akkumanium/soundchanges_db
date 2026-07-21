import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { currentModerator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ModeratorLoginPage() {
  if (await currentModerator()) redirect("/moderation");
  return <div className="page-shell content-page"><p className="eyebrow">Protected area</p><h1>Moderator sign-in</h1><p>This sign-in is only for appointed catalog editors.</p><LoginForm /></div>;
}
