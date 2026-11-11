import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-white">Welcome, {user.name.split(" ")[0]}</h1>
      <p className="mt-2 text-sm text-slate-400">
        Let&apos;s ship your first skill. This takes about three minutes: pick what it does, and SkillVault generates the
        package, tests, and model targets for you.
      </p>
      <div className="card mt-8 p-6">
        <OnboardingWizard userName={user.name} />
      </div>
    </div>
  );
}
