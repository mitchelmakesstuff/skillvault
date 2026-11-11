import JSZip from "jszip";

export type PackageFile = { path: string; content: string };

export async function buildZip(meta: Record<string, unknown>, files: PackageFile[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("skill.yaml", (meta.manifestYaml as string) ?? "");
  zip.file("skillvault.json", JSON.stringify(meta, null, 2));
  for (const f of files) {
    zip.file(f.path, f.content);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function readZip(buffer: ArrayBuffer | Buffer): Promise<PackageFile[]> {
  const zip = await JSZip.loadAsync(buffer);
  const files: PackageFile[] = [];
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const path = entry.name.replace(/^\/+/, "");
    if (path.includes("__MACOSX")) continue;
    files.push({ path, content: await entry.async("string") });
  }
  return files;
}

export function findManifest(files: PackageFile[]): PackageFile | undefined {
  return files.find((f) => f.path === "skill.yaml" || f.path.endsWith("/skill.yaml"));
}

export function stripCommonPrefix(files: PackageFile[]): PackageFile[] {
  const manifest = findManifest(files);
  if (!manifest || manifest.path === "skill.yaml") return files;
  const prefix = manifest.path.slice(0, -"skill.yaml".length);
  return files.map((f) => ({ path: f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path, content: f.content }));
}
