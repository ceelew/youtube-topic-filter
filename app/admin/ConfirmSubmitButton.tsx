"use client";

import { useFormStatus } from "react-dom";

export default function ConfirmSubmitButton({
  confirmMessage,
  children,
  pendingLabel,
  className,
}: {
  confirmMessage: string;
  children: React.ReactNode;
  /** Shown instead of children while the action is running — use for actions slow enough
   *  (seconds, not milliseconds) that an admin might wonder if their click registered. */
  pendingLabel?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
