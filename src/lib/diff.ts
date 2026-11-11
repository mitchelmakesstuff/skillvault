export type DiffRow = {
  type: "same" | "add" | "del";
  left?: string;
  right?: string;
  leftNo?: number;
  rightNo?: number;
};

export function diffLines(a: string, b: string): DiffRow[] {
  const left = a.length ? a.split("\n") : [];
  const right = b.length ? b.split("\n") : [];
  const n = left.length;
  const m = right.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = left[i] === right[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      rows.push({ type: "same", left: left[i], right: right[j], leftNo: i + 1, rightNo: j + 1 });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: "del", left: left[i], leftNo: i + 1 });
      i++;
    } else {
      rows.push({ type: "add", right: right[j], rightNo: j + 1 });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: "del", left: left[i], leftNo: i + 1 });
    i++;
  }
  while (j < m) {
    rows.push({ type: "add", right: right[j], rightNo: j + 1 });
    j++;
  }
  return rows;
}

export function diffStats(rows: DiffRow[]) {
  return {
    added: rows.filter((r) => r.type === "add").length,
    removed: rows.filter((r) => r.type === "del").length,
  };
}

export function fileLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    py: "python",
    sh: "shell",
    txt: "text",
    sql: "sql",
  };
  return map[ext] ?? "text";
}
