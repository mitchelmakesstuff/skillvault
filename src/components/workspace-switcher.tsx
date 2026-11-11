"use client";

import { useRouter } from "next/navigation";
import { switchOrgAction } from "@/app/actions/auth";

export function WorkspaceSwitcher({ current, options }: { current: { slug: string; name: string }; options: { slug: string; name: string }[] }) {
  const router = useRouter();
  return (
    <form
      action={async (formData) => {
        await switchOrgAction(formData);
        router.refresh();
      }}
    >
      <select
        name="orgSlug"
        defaultValue={current.slug}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input py-1.5 text-xs"
        aria-label="Active workspace"
      >
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.name}
          </option>
        ))}
      </select>
    </form>
  );
}
