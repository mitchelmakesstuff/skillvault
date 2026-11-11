import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkillVault — the release platform for AI skills",
  description:
    "Create an AI skill once, test it against real cases, version it safely, review changes, deploy it to the right models and environments, and know exactly what changed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
