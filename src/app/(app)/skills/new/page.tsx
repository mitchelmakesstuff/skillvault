import { requireWorkspace } from "@/lib/workspace";
import { NewSkillForm } from "./new-skill-form";

export default async function NewSkillPage() {
  const ws = await requireWorkspace();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-white">Create a skill</h1>
      <p className="mt-1 text-sm text-slate-400">
        SkillVault generates a structured package: manifest, instructions, tests, and per-model target overlays.
      </p>
      <div className="card mt-6 p-6">
        <NewSkillForm ownerTeamDefault={ws.orgName.toLowerCase().replace(/\s+/g, "-")} />
      </div>
    </div>
  );
}
