"use client";

import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
    >
      {pending ? "Refreshing..." : "Refresh now"}
    </button>
  );
}

export default function RefreshButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  return (
    <form action={action}>
      <SubmitButton />
    </form>
  );
}
