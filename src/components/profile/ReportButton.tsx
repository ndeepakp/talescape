"use client";

import { useState } from "react";

const REASONS = [
  "Not a genuine user",
  "Impersonation",
  "Spam or scam",
  "Inappropriate content",
  "Other",
];

// Report a user as not genuine. Opens an inline form; on submit the report goes
// into a (mock) due-diligence queue and the reader gets a confirmation.
export function ReportButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/users/${userId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not submit your report.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-xs text-zinc-500">
        Thanks — this report is now under review.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        Report this user
        <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 no-underline dark:bg-amber-950/40 dark:text-amber-300">
          Beta
        </span>
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-4 text-left dark:border-zinc-800 dark:bg-zinc-950">
      <p className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Report this user
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Beta
        </span>
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        This feature is in beta. Reports go to a review queue for due-diligence
        checks — no automated action is taken, and the reported user isn&apos;t
        told who reported them.
      </p>

      <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Reason
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Anything else we should know? (optional)"
        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-full btn-primary px-4 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
