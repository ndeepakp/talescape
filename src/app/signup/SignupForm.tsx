"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";

type Genre = { id: number; name: string };

const MIN_GENRES = 3;

export function SignupForm({ genres }: { genres: Genre[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Realtime handle availability: { user, available } for the latest checked
  // handle. Derived display compares against the current input.
  const [avail, setAvail] = useState<{ user: string; available: boolean } | null>(null);

  const handle = username.trim();
  useEffect(() => {
    if (handle.length < 3) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/username-check?u=${encodeURIComponent(handle)}`);
      const data = await res.json().catch(() => ({}));
      if (!cancelled) setAvail({ user: handle, available: !!data.available });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [handle]);

  // What to show under the handle field.
  const handleHint =
    handle.length === 0
      ? null
      : handle.length < 3
        ? { text: "Handles are at least 3 characters.", tone: "muted" as const }
        : avail?.user === handle
          ? avail.available
            ? { text: `$${handle} is available`, tone: "ok" as const }
            : { text: `$${handle} is already taken`, tone: "bad" as const }
          : { text: "Checking availability…", tone: "muted" as const };

  function toggleGenre(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selected.length < MIN_GENRES) {
      setError(`Please pick at least ${MIN_GENRES} genres you enjoy.`);
      return;
    }

    setLoading(true);

    // Check the handle is free before creating the account, so a clash doesn't
    // leave an orphaned account behind.
    const check = await fetch(`/api/username-check?u=${encodeURIComponent(username)}`);
    const checkData = await check.json().catch(() => ({}));
    if (!checkData.available) {
      setLoading(false);
      setError(checkData.error ?? `$${username} is already taken.`);
      return;
    }

    const { error: signUpError } = await signUp.email({ name, email, password });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message ?? "Could not create your account.");
      return;
    }

    // Sign-up signs the user in, so this request is authenticated.
    const res = await fetch("/api/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, bio: "", genreIds: selected }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save your profile.");
      return;
    }

    router.push("/feed");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--page)] px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Create your account
        </h1>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <Field label="Display name" value={name} onChange={setName} type="text" placeholder="Jane Writer" />

          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Handle</span>
            <div className="flex items-center rounded-lg border border-zinc-300 bg-white pl-3 focus-within:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-zinc-300">
              <span className="text-zinc-500">$</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
                placeholder="JaneWriter"
                required
                className="h-11 flex-1 bg-transparent px-1 text-zinc-900 outline-none dark:text-zinc-100"
              />
            </div>
            {handleHint ? (
              <span
                className={
                  "text-xs " +
                  (handleHint.tone === "ok"
                    ? "text-green-600"
                    : handleHint.tone === "bad"
                      ? "text-red-600"
                      : "text-zinc-500")
                }
              >
                {handleHint.text}
              </span>
            ) : (
              <span className="text-xs text-zinc-500">
                People find you with ${username || "handle"}.
              </span>
            )}
          </label>

          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 8 characters" />

          <div className="flex flex-col gap-2 text-left">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Favourite genres{" "}
              <span className="font-normal text-zinc-500">
                (pick at least {MIN_GENRES} — {selected.length} selected)
              </span>
            </span>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => {
                const active = selected.includes(g.id);
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => toggleGenre(g.id)}
                    className={
                      "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                      (active
                        ? "chip-active"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900")
                    }
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || handleHint?.tone === "bad"}
            className="mt-2 h-12 rounded-full btn-primary font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
      />
    </label>
  );
}
