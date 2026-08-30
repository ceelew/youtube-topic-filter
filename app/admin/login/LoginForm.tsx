"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/app/admin/actions";

const initialState: LoginFormState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</span>
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="min-h-[44px] rounded-lg border border-zinc-300 px-3 text-base text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>

      {!pending && state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-[44px] rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
