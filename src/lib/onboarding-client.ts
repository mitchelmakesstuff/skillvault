"use client";

export async function createSkill(input: { name: string; description: string; models: string[] }): Promise<{ slug?: string; error?: string }> {
  const res = await fetch("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? "Could not create the skill." };
  return { slug: data.slug };
}
