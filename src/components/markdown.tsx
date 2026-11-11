import { marked } from "marked";

export function Markdown({ source }: { source: string }) {
  const html = marked.parse(source, { async: false }) as string;
  return (
    <div
      className="prose-invert max-w-none space-y-3 text-sm leading-relaxed text-slate-300 [&_a]:text-accent-hover [&_code]:rounded [&_code]:bg-ink-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-white [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-ink-850 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_strong]:text-white [&_table]:w-full [&_th]:border-b [&_th]:border-ink-600 [&_th]:px-2 [&_th]:text-left"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
