export function parseSemver(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isValidSemver(v: string): boolean {
  return parseSemver(v) !== null;
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a) ?? [0, 0, 0];
  const pb = parseSemver(b) ?? [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export function bumpSemver(v: string, bump: "major" | "minor" | "patch"): string {
  const p = parseSemver(v);
  if (!p) return "1.0.0";
  const [major, minor, patch] = p;
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function nextVersionFor(current: string | null | undefined, bump: "major" | "minor" | "patch"): string {
  if (!current) return "0.1.0";
  return bumpSemver(current, bump);
}
