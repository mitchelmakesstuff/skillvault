"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { saveVersionAction, type FormState } from "@/app/actions/skills";
import { SubmitButton } from "@/components/submit-button";
import { fileLanguage } from "@/lib/diff";
import { Markdown } from "@/components/markdown";

type FileEntry = { path: string; content: string };

function buildTree(files: FileEntry[]) {
  const root: { name: string; children: Map<string, unknown>; files: string[] } = { name: "", children: new Map(), files: [] };
  const dirs = new Map<string, { name: string; children: Map<string, unknown>; files: string[] }>([["", root]]);
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = f.path.split("/");
    let key = "";
    for (let i = 0; i < parts.length - 1; i++) {
      const parent = dirs.get(key)!;
      key = key ? `${key}/${parts[i]}` : parts[i];
      if (!dirs.has(key)) {
        const node = { name: parts[i], children: new Map(), files: [] };
        parent.children.set(key, node);
        dirs.set(key, node);
      }
    }
    dirs.get(key)!.files.push(f.path);
  }
  return root;
}

function Tree({ node, depth, selected, onSelect }: { node: ReturnType<typeof buildTree>; depth: number; selected: string; onSelect: (p: string) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const entries = [...node.children.values()] as ReturnType<typeof buildTree>[];
  return (
    <div>
      {entries.map((child) => {
        const key = child.files[0]?.split("/").slice(0, depth + 1).join("/") ?? child.name;
        const isCollapsed = collapsed[key];
        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
              className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-slate-400 hover:bg-ink-800"
              style={{ paddingLeft: depth * 12 + 8 }}
            >
              <span className="text-slate-600">{isCollapsed ? "▸" : "▾"}</span>
              <span className="text-slate-300">{child.name}/</span>
            </button>
            {!isCollapsed ? (
              <div>
                <Tree node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
                {child.files.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onSelect(p)}
                    className={`block w-full truncate rounded px-2 py-1 text-left font-mono text-xs ${
                      selected === p ? "bg-accent/15 text-white" : "text-slate-400 hover:bg-ink-800"
                    }`}
                    style={{ paddingLeft: (depth + 1) * 12 + 20 }}
                  >
                    {p.split("/").pop()}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function EditorClient({ skillId, slug, initialFiles, canPublish }: { skillId: string; slug: string; initialFiles: FileEntry[]; canPublish: boolean }) {
  const [files, setFiles] = useState<FileEntry[]>(initialFiles);
  const [selected, setSelected] = useState(initialFiles.find((f) => f.path === "skill.yaml")?.path ?? initialFiles[0]?.path ?? "");
  const [preview, setPreview] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [state, formAction] = useActionState<FormState, FormData>(saveVersionAction, {});

  const tree = useMemo(() => buildTree(files), [files]);
  const current = files.find((f) => f.path === selected);
  const isMarkdown = selected.endsWith(".md");
  const isManifest = selected === "skill.yaml";
  const isTarget = selected.startsWith("targets/");
  const isShared = !isTarget && !isManifest;

  function updateContent(value: string) {
    setFiles((prev) => prev.map((f) => (f.path === selected ? { ...f, content: value } : f)));
  }

  function addFile() {
    const path = newPath.trim();
    if (!path || files.some((f) => f.path === path)) return;
    setFiles((prev) => [...prev, { path, content: path === "skill.yaml" ? "" : `# ${path}\n` }]);
    setSelected(path);
    setNewPath("");
  }

  function deleteFile() {
    if (selected === "skill.yaml") return;
    setFiles((prev) => prev.filter((f) => f.path !== selected));
    setSelected("skill.yaml");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="card self-start p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Files</span>
          <span className="text-[10px] text-slate-600">{files.length}</span>
        </div>
        <Tree node={tree} depth={0} selected={selected} onSelect={setSelected} />
        <div className="mt-3 border-t border-ink-800 pt-3">
          <input
            className="input py-1.5 font-mono text-xs"
            placeholder="new/path/file.md"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFile();
              }
            }}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-secondary flex-1 py-1 text-xs" onClick={addFile}>
              Add file
            </button>
            {selected && selected !== "skill.yaml" ? (
              <button type="button" className="btn-danger flex-1 py-1 text-xs" onClick={deleteFile}>
                Delete
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center justify-between border-b border-ink-800 px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-slate-300">{selected || "no file selected"}</span>
              <span className="text-[10px] uppercase text-slate-600">{fileLanguage(selected)}</span>
              {isManifest ? <span className="badge bg-accent/15 text-accent-hover">manifest</span> : null}
              {isTarget ? <span className="badge bg-emerald-500/15 text-emerald-300">{selected.split("/")[1]} overlay</span> : null}
              {isShared ? <span className="badge bg-sky-500/15 text-sky-300">shared source</span> : null}
            </div>
            {isMarkdown ? (
              <div className="flex gap-1 text-xs">
                <button type="button" className={`rounded px-2 py-1 ${!preview ? "bg-ink-700 text-white" : "text-slate-400"}`} onClick={() => setPreview(false)}>
                  Edit
                </button>
                <button type="button" className={`rounded px-2 py-1 ${preview ? "bg-ink-700 text-white" : "text-slate-400"}`} onClick={() => setPreview(true)}>
                  Preview
                </button>
              </div>
            ) : null}
          </div>
          {current ? (
            preview ? (
              <div className="max-h-[480px] overflow-auto p-5">
                <Markdown source={current.content} />
              </div>
            ) : (
              <textarea
                value={current.content}
                onChange={(e) => updateContent(e.target.value)}
                spellCheck={false}
                className="h-[480px] w-full resize-y rounded-b-lg bg-ink-950 p-4 font-mono text-xs leading-relaxed text-slate-200 focus:outline-none"
              />
            )
          ) : (
            <p className="p-6 text-sm text-slate-500">Add a file to start editing.</p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white">Save as new version</h3>
          <p className="mt-1 text-xs text-slate-500">
            Every save is an immutable version. A change summary is required; risk notes help reviewers.
            {!canPublish ? " You can save drafts, but publishing requires an approved review." : ""}
          </p>
          <form action={formAction} className="mt-4 space-y-3">
            <input type="hidden" name="skillId" value={skillId} />
            <input type="hidden" name="files" value={JSON.stringify(files)} />
            {state.error ? <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{state.error}</div> : null}
            <div>
              <label className="label" htmlFor="changeSummary">Change summary (required)</label>
              <input id="changeSummary" name="changeSummary" className="input" placeholder="Tighten escalation rules for billing tickets" />
            </div>
            <div>
              <label className="label" htmlFor="riskNotes">Risk notes (optional)</label>
              <input id="riskNotes" name="riskNotes" className="input" placeholder="Changes priority thresholds; may shift urgent volume" />
            </div>
            <div className="flex items-end gap-3">
              <div className="w-40">
                <label className="label" htmlFor="bump">Version bump</label>
                <select id="bump" name="bump" className="input" defaultValue="patch">
                  <option value="patch">patch (x.x.+1)</option>
                  <option value="minor">minor (x.+1.0)</option>
                  <option value="major">major (+1.0.0)</option>
                </select>
              </div>
              <SubmitButton pendingLabel="Saving version…">Save version</SubmitButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
