"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";

export function AvatarUpload({
  name,
  initialImage,
}: {
  name: string | null;
  initialImage: string | null;
}) {
  const router = useRouter();
  const [image, setImage] = useState(initialImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/me/avatar", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not upload that image.");
      return;
    }
    const data = await res.json();
    setImage(data.url);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me/avatar", { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setImage(null);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar src={image} name={name} size={72} />
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onPick}
          className="hidden"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="h-9 rounded-full btn-primary px-4 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Uploading…" : image ? "Change photo" : "Upload photo"}
          </button>
          {image && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="h-9 rounded-full px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Remove
            </button>
          )}
        </div>
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : (
          <p className="text-xs text-zinc-500">JPG, PNG, WEBP or GIF · up to 8 MB.</p>
        )}
      </div>
    </div>
  );
}
