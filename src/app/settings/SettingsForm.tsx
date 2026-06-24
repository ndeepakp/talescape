"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { PushToggle } from "@/components/settings/PushToggle";
import { ShelfPreview } from "@/components/settings/ShelfPreview";
import {
  ACCENTS,
  BACKGROUNDS,
  SHELF_STYLES,
  THEME_MODES,
  type AccentColor,
  type Appearance,
  type BackgroundPreset,
  type ShelfStyle,
  type ThemeMode,
} from "@/lib/appearance";

// Apply the chosen look to <html> right away so the change is visible while the
// user is still on this page. Mirrors the inline script in layout.tsx.
function applyLive(a: Pick<Appearance, "themeMode" | "accent" | "background" | "shelf">) {
  const el = document.documentElement;
  el.setAttribute("data-theme-mode", a.themeMode);
  el.setAttribute("data-accent", a.accent);
  el.setAttribute("data-bg", a.background);
  el.setAttribute("data-shelf", a.shelf);
  const dark =
    a.themeMode === "dark" ||
    (a.themeMode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  el.classList.toggle("dark", dark);
}

export function SettingsForm({
  userId,
  initial,
}: {
  userId: string;
  initial: Appearance;
}) {
  const router = useRouter();
  const [themeMode, setThemeMode] = useState<ThemeMode>(initial.themeMode);
  const [accent, setAccent] = useState<AccentColor>(initial.accent);
  const [background, setBackground] = useState<BackgroundPreset>(initial.background);
  const [shelf, setShelf] = useState<ShelfStyle>(initial.shelf);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feed wallpaper (uploaded image, shown only on the feed page).
  const [wallpaper, setWallpaper] = useState<string | null>(initial.feedWallpaper);
  const [wpBusy, setWpBusy] = useState(false);
  const [wpError, setWpError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Account deletion (danger zone).
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function uploadWallpaper(file: File) {
    setWpBusy(true);
    setWpError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/me/wallpaper", { method: "POST", body });
    setWpBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setWpError(data.error ?? "Could not upload that image.");
      return;
    }
    const data = await res.json();
    setWallpaper(data.url);
    router.refresh();
  }

  async function removeWallpaper() {
    setWpBusy(true);
    setWpError(null);
    const res = await fetch("/api/me/wallpaper", { method: "DELETE" });
    setWpBusy(false);
    if (!res.ok) {
      setWpError("Could not remove the wallpaper.");
      return;
    }
    setWallpaper(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await authClient.deleteUser({ password: deletePassword });
    if (error) {
      setDeleting(false);
      setDeleteError(
        error.message ??
          "Could not delete your account. Check your password and try again.",
      );
      return;
    }
    // Account is gone and the session is cleared — send them to the login page.
    router.push("/login");
    router.refresh();
  }

  // Reflect every change immediately on the live page.
  useEffect(() => {
    applyLive({ themeMode, accent, background, shelf });
  }, [themeMode, accent, background, shelf]);

  // When in "system" mode, follow the device if it flips light/dark.
  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyLive({ themeMode, accent, background, shelf });
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeMode, accent, background, shelf]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/me/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeMode, accent, background, shelf }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save your settings.");
      return;
    }
    setSaved(true);
    // Refresh so the server-rendered <html> attributes match what's saved.
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Changes preview instantly and save to your account, so they follow you
          to every device.
        </p>

        {/* Quick link to your public profile. */}
        <Link
          href={`/users/${userId}`}
          className="mt-5 inline-flex h-11 items-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          View profile
        </Link>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Notifications
        </h2>
        <div className="mt-4">
          <PushToggle />
        </div>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Appearance
        </h2>

        {/* Theme mode */}
        <div className="mt-8 flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Theme
          </span>
          <div className="grid grid-cols-3 gap-2">
            {THEME_MODES.map((m) => {
              const active = themeMode === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setThemeMode(m.id)}
                  className={
                    "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors " +
                    (active
                      ? "border-accent ring-1 ring-[var(--accent)]"
                      : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900")
                  }
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {m.label}
                  </span>
                  <span className="text-xs text-zinc-500">{m.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent colour */}
        <div className="mt-6 flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Accent colour
          </span>
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map((a) => {
              const active = accent === a.id;
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  aria-label={a.label}
                  aria-pressed={active}
                  title={a.label}
                  className={
                    "h-9 w-9 rounded-full transition-transform " +
                    (active
                      ? "ring-2 ring-offset-2 ring-zinc-900 ring-offset-[var(--page)] dark:ring-zinc-100"
                      : "hover:scale-110")
                  }
                  style={{ backgroundColor: a.swatch }}
                />
              );
            })}
          </div>
        </div>

        {/* Background */}
        <div className="mt-6 flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Background
          </span>
          <div className="grid grid-cols-3 gap-2">
            {BACKGROUNDS.map((b) => {
              const active = background === b.id;
              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setBackground(b.id)}
                  className={
                    "rounded-xl border px-3 py-2.5 text-center text-sm font-medium text-zinc-900 transition-colors dark:text-zinc-100 " +
                    (active
                      ? "border-accent ring-1 ring-[var(--accent)]"
                      : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900")
                  }
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Library shelf finish — applies to the bookshelf on your Library page. */}
        <div className="mt-6 flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Library shelf{" "}
            <span className="font-normal text-zinc-500">
              (the bookshelf on your{" "}
              <Link href="/library" className="underline">
                Library
              </Link>
              )
            </span>
          </span>
          <div className="flex items-stretch gap-3">
            {/* Live preview of the selected finish. */}
            <ShelfPreview shelf={shelf} />
            <div className="grid flex-1 grid-cols-2 gap-2 self-center">
              {SHELF_STYLES.map((s) => {
                const active = shelf === s.id;
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setShelf(s.id)}
                    className={
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium text-zinc-900 transition-colors dark:text-zinc-100 " +
                      (active
                        ? "border-accent ring-1 ring-[var(--accent)]"
                        : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900")
                    }
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-black/10 dark:border-white/15"
                      style={{ background: s.swatch }}
                      aria-hidden="true"
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Feed wallpaper — applies only to the feed page. */}
        <div className="mt-6 flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Feed wallpaper{" "}
            <span className="font-normal text-zinc-500">
              (shown only on your feed)
            </span>
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Beta
            </span>
          </span>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Heads up: this feature is in beta. Your wallpaper may be erased after
            you log out, so you might need to upload it again next time.
          </p>

          {wallpaper ? (
            <div className="overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wallpaper}
                alt="Current feed wallpaper"
                className="h-32 w-full object-cover"
              />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No wallpaper yet — your feed uses the background colour above.
            </p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadWallpaper(file);
            }}
          />

          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={wpBusy}
              className="h-10 rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              {wpBusy ? "Working…" : wallpaper ? "Replace image" : "Upload image"}
            </button>
            {wallpaper && !wpBusy && (
              <button
                type="button"
                onClick={removeWallpaper}
                className="text-sm text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            )}
          </div>
          <span className="text-xs text-zinc-500">
            JPG, PNG, WEBP, or GIF, up to 8&nbsp;MB.
          </span>
          {wpError && <p className="text-sm text-red-600">{wpError}</p>}
        </div>

        {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-12 rounded-full btn-primary px-6 font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && !saving && (
            <span className="text-sm text-zinc-500">Saved ✓</span>
          )}
        </div>

        {/* Danger zone — permanently delete this account. */}
        <div className="mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
            Delete account
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Permanently deletes your account and everything tied to it — your
            stories, comments, reactions, and follows. This can&apos;t be undone.
          </p>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="mt-4 h-11 rounded-full border border-red-300 px-5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Delete account
            </button>
          ) : (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-red-300 p-4 dark:border-red-900">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Enter your password to confirm
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
              />
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={deleting || deletePassword.length === 0}
                  className="h-11 rounded-full bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeletePassword("");
                    setDeleteError(null);
                  }}
                  className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
