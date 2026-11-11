# SkillVault — Investor Demo Script (~10 minutes)

**One-line pitch:** SkillVault is the release platform for AI skills — GitHub, Linear, and a CI/CD dashboard had a child. Teams build AI capabilities once, test them like software, and ship them to any model with a full audit trail.

**The problem:** Every company is accumulating AI prompts and agent instructions in Google Docs, Notion pages, and Slack threads. Nobody knows which version is live, what changed, whether it was tested, or who approved it. When a model upgrade breaks a workflow, there is no rollback. That's unacceptable for anything a business depends on.

**The fix:** treat AI skills exactly like production software — packages, versions, tests, reviews, releases.

---

## 1. Landing page — `/` (30s)

**Click:** scroll once, then "Sign in".

**Problem it solves:** positioning in five seconds. This is a lifecycle and release platform, not a prompt saver. The landing states the value prop verbatim: *create once, test against real cases, version safely, review changes, deploy to the right models, know exactly what changed.*

## 2. Log in — `/login` (15s)

**Click:** sign in as `demo@skillvault.dev` / `demo1234` (Owner of the Northwind Support workspace).

**Problem it solves:** workspaces and roles exist from day one. This is B2B infrastructure, not a consumer tool.

## 3. Dashboard — `/dashboard` (45s)

**What to say:** "This is the CI/CD view of our AI capabilities." Point at the lifecycle counters — skills in review, versions awaiting approval, failing evaluations — and the recent activity feed.

**Problem it solves:** a lead opens one screen and knows the health of every AI capability the team runs. No digging through docs.

## 4. Skill library — `/skills` (30s)

**Click:** use the status/tag/model filters; search "triage".

**Problem it solves:** discovery for the non-engineer persona. A product owner can find an approved skill by what it does, who owns it, and which models it supports — without reading a raw prompt file.

## 5. Skill detail — `/skills/customer-support-triage` (60s)

**What to say:** "One canonical skill, many destinations." Point out:

- current published version and release history with author, approver, and changed files;
- declared model targets (Claude, OpenAI, Gemini) and which files are shared vs. provider overlays;
- **portability risks** — the system explicitly flags provider-specific syntax and missing test coverage instead of pretending prompts are portable.

**Problem it solves:** model neutrality with honesty. Teams see exactly what's shared and what's model-specific before they deploy.

## 6. Editor — `/skills/customer-support-triage/edit` (45s)

**Click:** open `skill.yaml`, then an instruction file; toggle the Markdown preview; note the standard package tree (`instructions/`, `tools/`, `tests/`, `targets/`).

**Problem it solves:** skills are structured packages with a validated manifest, not loose text. Saving creates a new immutable version automatically.

## 7. Version diff + failed eval gate — `/skills/customer-support-triage/versions` → open v1.2.0 (90s) ⭐ *the key scene*

**What to do and say:**

1. Show the readable line diff — "reviewers see exactly what changed in plain English terms, like a pull request."
2. Point at the evaluation evidence: the required model-based eval **failed** on v1.2.0.
3. **Click "Publish"** — it's blocked, with a clear explanation that required tests failed.
4. Sign out, sign in as `admin@skillvault.dev` / `demo1234`, return to the same version, and use **Admin override with a documented reason**.

**Problem it solves:** the trust story. SkillVault will not let anyone ship an untested skill silently. Overrides are possible in emergencies, but they are explicit, documented, and auditable. This is the difference between a prompt saver and a release platform.

## 8. Review queue — `/reviews` (45s)

Sign back in as the Owner. **Click:** the in-review version; approve or reject with a comment.

**Problem it solves:** the reviewer persona gets diff + eval results + risk notes in one place, and the approval decision is recorded. Also note the Reviewer role **cannot** publish — roles are enforced, not decorative.

## 9. Test dashboard — `/skills/customer-support-triage/tests` (45s)

**Click:** show the three test types — static validation, model-based evaluation, regression vs. prior approved version — and a recent eval run with model, latency, token usage, and cost.

**Problem it solves:** evaluation is a first-class artifact with evidence (model version, latency, tokens, cost), not a vibe. Cost and regression tracking are the hooks teams need before they trust automation.

## 10. Gallery + fork — `/gallery` (45s)

**Click:** open a public skill from Open Collective Labs, then "Fork into workspace".

**Problem it solves:** distribution and reuse. Skills are assets teams can share org-wide or publicly with license and author metadata, and anyone can fork a proven skill instead of starting from zero. (Payments/marketplace is a deliberate later-stage seam.)

## 11. Settings, audit, secrets — `/settings` (60s)

**Click:** team roles → webhooks → API keys → secrets (masked only) → audit log.

**What to say:** "Every publish, approval, override, and role change is recorded here. Secrets are encrypted at rest and never displayed. The platform admin can answer: which skill, used by whom, in which environment, with which model version."

**Problem it solves:** the security/admin persona and procurement. Auditability is built into the data model, not bolted on.

## 12. Integrations — close from `/skills/[slug]` (30s)

**Click:** export links — portable ZIP, Claude Code skill directory, Custom GPT instructions. Mention the API (`/api/v1/...` with API keys) and webhooks on publish, approval, and failed evaluation.

**Problem it solves:** skills reach the places work actually happens — Claude Code, Custom GPTs, agents, internal pipelines — from one source of truth.

---

## Closing line

"Every company is becoming a consumer of AI capabilities, and today those capabilities are managed like copy-paste text. SkillVault makes them software: versioned, tested, reviewed, and deployed with a full audit trail. The wedge is the release workflow; the expansion is every team that runs AI in production."

## Demo tips

- The failed-eval → override sequence (scene 7) is the money moment — rehearse it.
- All demo users share the password `demo1234`; the role-swap in scene 7 is the only account change.
- If asked "are the model evals real?": the MVP ships with a deterministic simulated evaluator and a clean `MODEL_PROVIDER` seam — the run records (model, latency, tokens, cost) are real data structures; wiring a live provider is an adapter, not a re-architecture.
- If asked about Git: the sync endpoint is a documented stub; ZIP import/export and the package format already match a Git-friendly directory layout.
