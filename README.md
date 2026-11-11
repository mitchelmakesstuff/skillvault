# SkillVault

**A skill lifecycle and release platform for AI teams.**

SkillVault is not a prompt library. It is the system of record for AI capabilities that teams treat like production software: create an AI skill once, test it against real cases, version it safely, review changes, deploy it to the right models and environments, and know exactly what changed.

An **AI Skill** in SkillVault is a versioned package containing instructions/system prompts, task documentation, scripts and assets, tool definitions and permissions, test cases and evaluation suites, model-specific overlays, and release metadata with approval history.

---

## Quickstart

Requirements: Node.js 20+ and npm. PostgreSQL can either be provided by you or run locally via the bundled embedded Postgres binaries (no Docker needed).

```bash
npm install

# Option A: embedded local Postgres (loopback-only, port 54329, data in ./embedded-postgres-data)
npm run db:start
npx prisma db push
npm run db:seed

# Option B: your own Postgres
# set DATABASE_URL in .env, then:
npx prisma db push && npm run db:seed

npm run dev          # http://localhost:3000
```

Environment (`.env`, see `.env.example`):

```
DATABASE_URL="postgresql://skillvault:skillvault@127.0.0.1:54329/skillvault"
APP_SECRET="<openssl rand -hex 32>"   # signs sessions, HMACs webhooks, derives the secrets-encryption key
```

### Demo credentials

All demo users use password `demo1234`:

| Email | Workspace | Role |
| --- | --- | --- |
| `demo@skillvault.dev` | Northwind Support | Owner |
| `admin@skillvault.dev` | Northwind Support | Admin |
| `reviewer@skillvault.dev` | Northwind Support | Reviewer |
| `editor@skillvault.dev` | Northwind Support | Editor |
| `viewer@skillvault.dev` | Northwind Support | Viewer |
| `eng@acme.dev` | Acme Platform | Owner |
| `public@skillvault.dev` | Open Collective Labs | Owner |

Seed data: 3 workspaces, 12 skills across the lifecycle (draft → in review → approved → published, including a deprecated one), 15 immutable versions with real diffs, 11 evaluation runs including a **failed required eval that blocks publishing**, an approval workflow in progress, a webhook, an API key, an encrypted secret, and audit history.

The flagship demo skill is `customer-support-triage` in Northwind Support: v1.0.0 and v1.1.0 are published with releases, approvals, and passing evals; v1.2.0 is in review with a failed model-based eval — try publishing it to see the gate, then use the Admin override with a documented reason.

Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run build        # next build
npm run db:stop      # stop embedded Postgres
```

---

## Architecture

### Stack

- **Next.js 15 (App Router) + React 19 + TypeScript** — server components read the database directly through a Prisma singleton; all mutations go through `"use server"` actions using the `useActionState` pattern.
- **Tailwind CSS** — dark, developer-focused theme (`ink` grays, `accent` indigo) in the spirit of Linear/Vercel.
- **Prisma + PostgreSQL** — multi-tenant from day one via `Organization` / `Membership`.
- **Auth**: bcryptjs password hashing + a `jose`-signed JWT session cookie (`sv_session`, 7 days). Active workspace is an org cookie (`sv_org`).
- **Crypto** (`src/lib/crypto.ts`): AES-256-GCM for secrets at rest, HMAC-SHA256 for webhook signatures, masked display for anything sensitive. Secrets are never returned to the UI.

### Repository layout

```
prisma/schema.prisma        # all models and enums
prisma/seed.ts              # demo data
scripts/dev-db.mjs          # embedded Postgres control (initdb/pg_ctl, loopback-only)
src/lib/
  db.ts  auth.ts  workspace.ts  rbac.ts  api-auth.ts
  crypto.ts  audit.ts  semver.ts  diff.ts  manifest.ts
  portability.ts  evals.ts  webhooks.ts  skill-package.ts  skills.ts
src/app/actions/            # server actions: auth, skills, admin
src/app/(app)/              # authenticated UI: dashboard, skills, editor,
                            # versions, tests, reviews, gallery, settings
src/app/api/                # auth, skill create, exports, integrations, /api/v1
src/components/             # badges, sidebar, markdown renderer, submit button
```

### Data model (core tables)

- `User`, `Organization`, `Membership` (role per workspace)
- `Skill` — slug, description, owner, visibility (`PRIVATE`/`TEAM`/`ORGANIZATION`/`PUBLIC`), tags, status (`DRAFT`/`IN_REVIEW`/`APPROVED`/`PUBLISHED`/`DEPRECATED`/`ARCHIVED`), declared model targets
- `SkillVersion` — **immutable** snapshot per save, per branch, with semver `major.minor.patch` and status (`DRAFT`/`IN_REVIEW`/`APPROVED`/`REJECTED`/`PUBLISHED`)
- `SkillFile` — path + content inside a version (the package: `skill.yaml`, `instructions/`, `assets/`, `tools/`, `tests/`, `targets/`, `releases/`)
- `TestCase`, `EvalRun`, `EvalResult` — test definitions and evaluation history (model, model version, latency, tokens, cost micros, per-test results, overall status)
- `Release` — publish record: changed files, eval run evidence, approver, change summary, risk notes
- `Approval` — reviewer decisions on a version
- `AuditLog`, `Webhook`, `ApiKey`, `Secret`

### Skill package format

Every version stores the full package. The canonical source is model-neutral; provider overlays live under `targets/`:

```
skill.yaml
instructions/
assets/
tools/
tests/
targets/claude/
targets/openai/
targets/gemini/
releases/
```

`skill.yaml` is validated with zod + a YAML parser on save and on publish (name, slug, description, version, models, inputs/outputs, tools, required tests). See the sample in the original brief for the shape.

### Version, evaluation, and publish flow

1. **Save** in the editor → new immutable `SkillVersion` on the current branch, semver auto-bumped per branch.
2. **Edit `skill.yaml`** → schema validated; errors block the save.
3. **Run evaluation** (`src/lib/evals.ts`) — three test types:
   - **Static validation**: manifest validity, required files, forbidden-content regexes.
   - **Model-based evaluation**: scored run per test case with model/version/latency/tokens/cost. *Currently a deterministic simulated run — see "Architectural seams" for the `MODEL_PROVIDER` extension point.*
   - **Regression testing**: file drift comparison against a prior approved version (drift score ≥ 0.7 and valid manifest to pass).
4. **Submit for review** → appears in the Review queue with a readable line diff (LCS-based, `src/lib/diff.ts`), eval evidence, and risk notes.
5. **Approve / reject** → recorded in `Approval` + audit log.
6. **Publish** → requires approval **and** a passing required eval. If a required eval failed, only an **Admin+** can override, and only with a documented reason (stored on the release, audited, webhooks fired). Publishing creates a `Release` and bumps the skill's current version.
7. **Restore** any prior version → creates a new version with its content (history is never rewritten).

### RBAC

Roles are ranked; permissions require a minimum rank (`src/lib/rbac.ts`):

| Permission | Viewer | Reviewer | Editor | Admin | Owner |
| --- | :-: | :-: | :-: | :-: | :-: |
| `skill.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `skill.review` | | ✓ | ✓ | ✓ | ✓ |
| `skill.create` / `skill.edit` / `skill.publish` / `eval.run` | | | ✓ | ✓ | ✓ |
| `workspace.manage` / `admin.override` / `secrets.manage` / `audit.view` | | | | ✓ | ✓ |
| `workspace.billing` | | | | | ✓ |

### Multi-model targeting and portability

- Skills declare supported models; `targets/<provider>/` overlays override shared files for that provider.
- The skill detail page shows which files are shared vs. model-specific via target coverage.
- `src/lib/portability.ts` scans shared content for portability risks: Anthropic XML tags, OpenAI function-call syntax, Gemini grounding attributes, system-prompt assumptions, JSON-mode assumptions, provider name mentions, and temperature settings inside prompts. Missing test coverage for a declared target is flagged too. Risks are surfaced with severity badges — differences are made explicit, never hidden.

### Sharing and publishing

- Visibility: private → team → organization → public.
- Public skills appear in the in-app gallery with license, author, model compatibility, usage counts, and one-click **fork** into your workspace.
- Import: upload a ZIP package (or point the Git-sync endpoint at a repo — stub, see below).
- Export: portable ZIP package, Claude Code skill directory ZIP, Custom GPT instructions TXT.

---

## API

Session-authenticated (browser) routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/signup` · `/api/auth/login` | JSON auth (used by the onboarding wizard) |
| `POST` | `/api/skills` | Create a skill (onboarding wizard) |
| `GET` | `/api/skills/[slug]/export` | Portable ZIP package |
| `GET` | `/api/integrations/claude-code/[slug]` | Claude Code skill directory ZIP |
| `GET` | `/api/integrations/custom-gpt/[slug]` | Custom GPT instructions (TXT) |
| `POST` | `/api/integrations/git-sync` | GitHub/GitLab sync **stub** (returns a documented not-implemented plan) |

API-key-authenticated routes (`Authorization: Bearer <key>`, keys created in Settings; SHA-256 hashed at rest, prefix used for lookup):

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/skills` | List skills in the key's workspace |
| `GET` | `/api/v1/skills/[slug]` | Skill metadata + latest published version |
| `GET` | `/api/v1/skills/[slug]/versions/[version]` | Exact version, files included |

Webhooks are dispatched on publish, approval, and failed evaluation, signed with HMAC-SHA256 (`X-SkillVault-Signature` header) using the workspace's webhook secret.

---

## UI map

| Page | Route |
| --- | --- |
| Landing | `/` |
| Log in / Sign up | `/login`, `/signup` |
| Onboarding (first skill < 5 min) | `/onboarding` |
| Workspace dashboard | `/dashboard` |
| Skill library (search + filters) | `/skills` |
| New / import skill | `/skills/new` |
| Skill detail (releases, targets, risks) | `/skills/[slug]` |
| Skill editor (file tree, markdown preview) | `/skills/[slug]/edit` |
| Version history | `/skills/[slug]/versions` |
| Version detail (diff, evals, review, publish) | `/skills/[slug]/versions/[versionId]` |
| Test / evaluation dashboard | `/skills/[slug]/tests` |
| Review queue | `/reviews` |
| Public gallery | `/gallery` |
| Settings (team, webhooks, API keys, secrets, audit log) | `/settings` |

---

## Architectural seams (intentional MVP exclusions)

Each excluded capability has a clean extension point:

- **Live model evaluation** — `runEvaluation` in `src/lib/evals.ts` simulates model runs deterministically and is labeled as such in the UI. Wire a `MODEL_PROVIDER` adapter (Anthropic/OpenAI/Gemini clients) into the same run/result recording to go live.
- **Git sync** — `/api/integrations/git-sync` returns a documented plan (webhook receiver + two-way package mapping); `src/lib/skill-package.ts` already does ZIP ⇄ package conversion, which is the hard part.
- **SSO / SAML** — `Membership` + `Organization` are in place; add an identity-provider table and swap `src/lib/auth.ts` session issuance.
- **Marketplace payments, fine-tuning, agent execution, SOC 2, self-hosting, cost optimization, real-time collaboration** — not built. The schema and service layer (`src/lib/skills.ts`) keep publishing, usage counting, and audit events as first-class records so these can attach without re-architecture.

## Product roadmap

1. **Now (MVP)** — workspaces, RBAC, skill packages, immutable versions + diffs, semver releases, three test types, publish gating with admin override, multi-model overlays + portability risks, gallery + fork, ZIP import/export, Claude Code / Custom GPT exports, webhooks, API, audit log.
2. **Next** — live model-based evals (`MODEL_PROVIDER`), real GitHub/GitLab two-way sync, scheduled regression suites, eval cost dashboards, per-environment deploy targets (staging/prod skills), Slack/Teams approval notifications.
3. **Later** — SSO/SAML + SCIM, SOC 2 track (the audit log and secret handling are designed for it), marketplace payments and revenue share, usage analytics (which skill, whom, which model version — the data model already records it), real-time collaborative editing, self-hosted distribution.

## Security notes

- Secrets are encrypted with AES-256-GCM using a key derived from `APP_SECRET`; only masked values ever reach the UI.
- API keys are stored as SHA-256 hashes; only the prefix is queryable.
- Passwords use bcrypt; sessions are signed JWTs in httpOnly cookies.
- Webhook payloads are HMAC-signed; receivers can verify authenticity.
- All privileged actions (role changes, overrides, publishes, secret changes) are written to the audit log.
