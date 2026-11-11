import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { can, ROLE_LABELS } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { maskSecret } from "@/lib/crypto";
import {
  inviteMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
  createWebhookAction,
  deleteWebhookAction,
  createApiKeyAction,
  deleteApiKeyAction,
  createSecretAction,
  deleteSecretAction,
} from "@/app/actions/admin";
import { TeamForms, WebhookForm, ApiKeyForm, SecretForm } from "./settings-forms";

export default async function SettingsPage() {
  const ws = await requireWorkspace();
  const [members, webhooks, apiKeys, secrets, audit] = await Promise.all([
    db.membership.findMany({ where: { orgId: ws.orgId }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    db.webhook.findMany({ where: { orgId: ws.orgId }, orderBy: { createdAt: "desc" } }),
    db.apiKey.findMany({ where: { orgId: ws.orgId }, orderBy: { createdAt: "desc" } }),
    db.secret.findMany({ where: { orgId: ws.orgId }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ where: { orgId: ws.orgId }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const manage = can(ws.role, "workspace.manage");

  return (
    <div>
      <PageHeader title="Workspace settings" subtitle={`${ws.orgName} — team, integrations, secrets, and audit trail.`} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-white">Team</h2>
          <div className="card divide-y divide-ink-800">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm text-white">{m.user.name}</div>
                  <div className="text-xs text-slate-500">{m.user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {manage && m.role !== "OWNER" ? (
                    <>
                      <form action={updateMemberRoleAction}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <select name="role" defaultValue={m.role} className="input py-1 text-xs">
                          {Object.keys(ROLE_LABELS).filter((r) => r !== "OWNER").map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS]}</option>
                          ))}
                        </select>
                        <button type="submit" className="btn-secondary px-2 py-1 text-[10px]">save</button>
                      </form>
                      <form action={removeMemberAction}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button type="submit" className="text-xs text-slate-500 hover:text-red-400">remove</button>
                      </form>
                    </>
                  ) : (
                    <span className="badge bg-ink-800 text-slate-300">{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {manage ? <TeamForms /> : null}
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-white">Webhooks</h2>
            <div className="card divide-y divide-ink-800">
              {webhooks.length === 0 ? <p className="px-5 py-4 text-xs text-slate-500">No webhooks configured.</p> : null}
              {webhooks.map((h) => (
                <div key={h.id} className="px-5 py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-300">{h.url}</span>
                    {manage ? (
                      <form action={deleteWebhookAction}>
                        <input type="hidden" name="webhookId" value={h.id} />
                        <button type="submit" className="text-slate-500 hover:text-red-400">remove</button>
                      </form>
                    ) : null}
                  </div>
                  <div className="mt-1 text-slate-500">{h.events.join(", ")}</div>
                </div>
              ))}
            </div>
            {manage ? <WebhookForm /> : null}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-white">API keys</h2>
            <div className="card divide-y divide-ink-800">
              {apiKeys.length === 0 ? <p className="px-5 py-4 text-xs text-slate-500">No API keys yet.</p> : null}
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between px-5 py-3 text-xs">
                  <div>
                    <div className="font-mono text-slate-300">{k.prefix}.••••••••</div>
                    <div className="text-slate-600">created {k.createdAt.toISOString().slice(0, 10)}{k.lastUsedAt ? ` · last used ${k.lastUsedAt.toISOString().slice(0, 10)}` : ""}</div>
                  </div>
                  {manage ? (
                    <form action={deleteApiKeyAction}>
                      <input type="hidden" name="keyId" value={k.id} />
                      <button type="submit" className="text-slate-500 hover:text-red-400">revoke</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
            {manage ? <ApiKeyForm /> : null}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-white">Secrets</h2>
            <p className="mb-3 text-xs text-slate-500">Encrypted at rest with AES-256-GCM. Values are never returned by the API or shown in the UI.</p>
            <div className="card divide-y divide-ink-800">
              {secrets.length === 0 ? <p className="px-5 py-4 text-xs text-slate-500">No secrets stored.</p> : null}
              {secrets.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3 text-xs">
                  <span className="font-mono text-slate-300">{maskSecret(s.name)}</span>
                  {manage ? (
                    <form action={deleteSecretAction}>
                      <input type="hidden" name="secretId" value={s.id} />
                      <button type="submit" className="text-slate-500 hover:text-red-400">delete</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
            {manage ? <SecretForm /> : null}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-white">Audit log</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-ink-800 text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-medium">When</th>
                <th className="px-5 py-2.5 font-medium">Actor</th>
                <th className="px-5 py-2.5 font-medium">Action</th>
                <th className="px-5 py-2.5 font-medium">Target</th>
                <th className="px-5 py-2.5 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {audit.map((a) => (
                <tr key={a.id} className="text-slate-400">
                  <td className="whitespace-nowrap px-5 py-2">{a.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td className="px-5 py-2">{a.actorEmail ?? "system"}</td>
                  <td className="px-5 py-2 font-mono text-accent-hover">{a.action}</td>
                  <td className="px-5 py-2 text-slate-500">{a.targetType}</td>
                  <td className="max-w-xs truncate px-5 py-2 text-slate-600">{a.metadata ? JSON.stringify(a.metadata) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
