"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCY } from "@/lib/pricing";
import { AvatarUpload } from "@/components/AvatarUpload";

type Genre = { id: number; name: string };

type Profile = {
  id: string;
  name: string;
  username: string;
  bio: string;
  about: string;
  subscriptionPrice: number | null;
  image: string | null;
  genreIds: number[];
};

const MAX_ABOUT = 2000;

const MIN_GENRES = 3;

export function ProfileForm({
  genres,
  profile,
}: {
  genres: Genre[];
  profile: Profile;
}) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [about, setAbout] = useState(profile.about);
  const [subscriptionPrice, setSubscriptionPrice] = useState(
    profile.subscriptionPrice ? String(profile.subscriptionPrice) : "",
  );
  const [selected, setSelected] = useState<number[]>(profile.genreIds);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    const res = await fetch("/api/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        username,
        bio,
        about,
        subscriptionPrice: subscriptionPrice ? Number(subscriptionPrice) : 0,
        genreIds: selected,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save your profile.");
      return;
    }

    router.push(`/${username || profile.id}`);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--page)] px-6 py-12">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Edit profile
        </h1>

        <div className="mt-8">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Profile picture
          </span>
          <div className="mt-2">
            <AvatarUpload name={profile.name} initialImage={profile.image} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Display name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Handle
            </span>
            <div className="flex items-center rounded-lg border border-zinc-300 bg-white pl-3 focus-within:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-zinc-300">
              <span className="text-zinc-500">$</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
                required
                placeholder="Deepak"
                className="h-11 flex-1 bg-transparent px-1 text-zinc-900 outline-none dark:text-zinc-100"
              />
            </div>
            <span className="text-xs text-zinc-500">
              3–20 letters, numbers, or underscores. People find you with ${username || "handle"}.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Status <span className="font-normal text-zinc-500">(optional)</span>
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="A short line that captures your current mood or status."
              className="rounded-lg border border-zinc-300 bg-white p-3 text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-left">
            <span className="flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span>
                About <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <span className="font-normal text-zinc-500">
                {about.length}/{MAX_ABOUT}
              </span>
            </span>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={6}
              maxLength={MAX_ABOUT}
              placeholder="Tell readers more about you — your motto, what drives you, your day-to-day, hobbies and interests."
              className="rounded-lg border border-zinc-300 bg-white p-3 text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Subscription price{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </span>
            <div className="flex items-center rounded-lg border border-zinc-300 bg-white pl-3 focus-within:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-zinc-300">
              <span className="text-zinc-500">{CURRENCY}</span>
              <input
                type="number"
                min={0}
                value={subscriptionPrice}
                onChange={(e) => setSubscriptionPrice(e.target.value)}
                placeholder="0"
                className="h-11 flex-1 bg-transparent px-2 text-zinc-900 outline-none dark:text-zinc-100"
              />
              <span className="px-3 text-sm text-zinc-500">/ 30 days</span>
            </div>
            <span className="text-xs text-zinc-500">
              Set a price to offer a subscription. Subscribers can read all your
              private chapters while their subscription is active. Leave blank or
              0 to not offer one.
            </span>
          </label>

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
            disabled={loading}
            className="mt-2 h-12 rounded-full btn-primary font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
