# Talerooms — Product Roadmap

Where the product is *heading* (user-facing direction). Infra/launch-blockers
live in [MUST_TO_DO.md](MUST_TO_DO.md); this is the "what experiences do we
build" list. Roughly priority-ordered.

---

## 🌟 North-star themes

### 1. The serial habit — build the "next chapter" loop (highest leverage)
Serialized fiction wins on *the appointment*: "the next chapter drops Friday and
I'll be here." This is Talerooms' missing heartbeat — today it's more a bookstore
(buy once) than a serial you live in.
- **Follow a story/author → get pulled back when a new chapter lands** (a "new
  chapters for you" feed + a notification / email digest: "3 chapters dropped in
  stories you're reading").
- **Release cadence** for writers — schedule chapters, "updates Tuesdays."
- **Library / Currently Reading shelf** with new-chapter badges, surfaced first.

Why: turns one-time readers into a daily habit, and gives writers a reliable
audience — both sides of the marketplace get healthier at once.

### 2. Discovery — the cold-start killer
A content marketplace lives or dies on "what do I read next?" Today we have a
genre feed + search (table stakes). The leap:
- **"Because you read X"** recommendations, trending / rising.
- Human-curated **staff picks & themed collections.**
- For writers, this answers their scariest question: *will anyone find my story?*

### 3. Audio (a real wedge)
Let readers **listen** to chapters (TTS first, narration later). Turns commutes /
chores / bedtime into Talerooms time, bridges to the Kids vertical (read-aloud)
and accessibility. Few text-fiction platforms do this well.

### 4. IP marketplace (the endgame, from the README)
A marketplace for **original narrative IP** — studios browsing, licensing,
optioning. The thing Substack/Patreon/Wattpad can't credibly claim because they
aren't originality-first. Far off, but every feature above quietly builds the
catalogue and signal that make it real.

---

## 📋 Tracked features

### A. Make chapters optional
Let a story be published with **no chapters** (just title + summary / pitch), and
chapters added later. Directly enables the serial loop ("publish the pitch, drop
chapters over time"). *Status: small — verify current validation and the reader
empty-state.*

### B. Expiry → win-back: "re-subscribe at a reduced price"
When a reader's access to a story/chapter (an access grant or a subscription) is
**about to expire**, send a notification (and later email) nudging them to renew
**at a discounted price**. Retention + monetization in one.
- Detect grants/subscriptions nearing expiry (we already raise `sub_expiring`
  for subscriptions — extend to per-story/chapter access grants).
- Generate a time-limited discounted renewal offer + a one-tap re-buy.
- *Status: medium — needs a discount mechanism + an expiry sweep.*

---

_Add new product directions below as they come up._
