# TALEROOMS

> Where stories find their people.

TALEROOMS is a creator‑first storytelling platform and IP marketplace. Writers
publish stories as a public summary plus private, paid chapters; readers
discover work, buy access on their own terms, and follow the authors they love.

---

## 1. What is TALEROOMS?

TALEROOMS is a web application for **serialized, original fiction** where the
creator owns the economics. Every story has a public **title + summary** that
anyone can see, and **chapters** that the author controls — keep them free,
sell them chapter‑by‑chapter, bundle the whole story, or open everything to
subscribers.

It is **not** another free‑reading mill. It is closer to *Substack / Patreon for
serialized fiction*, with an originality‑first stance and an ambition to become a
marketplace for narrative IP.

Core ideas:

- **Public summary, private chapters.** Readers always see the pitch; the
  content is gated by the author's rules.
- **Originality matters.** New stories are checked for similarity against
  existing work at publish time, and every author affirms an originality pledge.
- **The creator sets the price.** Pricing, durations and subscriptions are the
  author's to decide — not the platform's.

### How TALEROOMS is different from Substack, Patreon & Wattpad

There is adjacency with all three, but none occupy TALEROOMS' exact position:
**paid-first, original serialized fiction with creator-set granular pricing,
enforced originality, and an IP-marketplace ambition.**

| Dimension | **TALEROOMS** | **Substack** | **Patreon** | **Wattpad** |
|---|---|---|---|---|
| **Core category** | Paid, original *serialized fiction* marketplace | Subscription publishing (newsletters/essays) | Membership/patronage for any creator | Free-first social fiction community |
| **Primary content** | Chapter-by-chapter fiction | Long-form writing, mostly non-fiction | Anything (posts, art, video, audio) | Serialized fiction (much fan-fic/amateur) |
| **Default price stance** | **Paid-first**, creator-priced | Free or paid newsletter | Paid membership tiers | **Free-first**, ads + optional coins |
| **Payment granularity** | **Per-chapter, whole-story bundle, *and* subscription** | Subscription only | Monthly tier only | Platform "coins" per part; mostly free |
| **Access flexibility** | **Hour / day / week / year / forever** | Ongoing sub | Ongoing sub | Unlock/own a part |
| **Public pitch, gated body** | **Yes** — summary public, chapters gated by author rules | Some posts paywalled | Tier-gated posts | Mostly fully public |
| **Originality enforcement** | **Similarity check at publish + author pledge** | None | None | None (derivative content common) |
| **Discovery / social feed** | Genre feed, search, follows, reviews | Limited | Almost none — bring your own audience | **Very strong** (its core strength) |
| **Reading experience** | Paginated reader, bookmarks, continue-reading, in-line word lookup, collections | Email/web article | Plain posts | Inline comments, votes, lists |
| **Who owns the audience** | Creator (direct paying readers) | **Creator owns email list** | Creator owns patron list | Platform owns the relationship |
| **IP / adaptation ambition** | **Originality-first IP marketplace** (studio licensing) | None | None | Adaptation arm — from amateur/free corpus |
| **Audience skew** | Original-fiction readers willing to pay | Knowledge/newsletter readers | Fans of a specific creator | Huge, young, free-reading |

**The wedge:** originality enforcement is the one promise the other three
structurally cannot make — it's what turns the catalogue into licensable IP
rather than a free fan-fiction pile. The real risk is not the concept but
*distribution* — a two-sided marketplace must attract original writers **and**
paying readers, which is the normal (and hardest) marketplace problem.

---

## 2. TALEROOMS for Content Creators

If you write, TALEROOMS is built so your work earns for you and stays yours.

What you can do today:

- **Publish a story** with a title, a short summary, genres and rich‑text
  chapters (bold, italics, underline, fonts, alignment, quotes, lists).
- **Choose visibility** per story: keep chapters **public** (free) or **private**
  (paid / subscriber‑only).
- **Price your work** — set a whole‑story bundle price and/or an individual
  price for each chapter, across the access durations you offer.
- **Offer a subscription** at your own price — subscribers unlock everything you
  write while their subscription is active.
- **Drafts** that are private to you and auto‑expire if abandoned, so your shelf
  stays clean.
- **Know your audience** with a personal analytics dashboard: views, purchases,
  earnings and active subscribers over a selectable window, with expandable
  graphs.
- **Stay in the loop** with notifications for purchases, new followers,
  comments, likes/dislikes and new subscribers.
- **Protect your work** — an originality/similarity check at publish, an
  originality pledge, and full control over who can read (approve, revoke).

How you benefit: you keep creative and pricing control, you build a direct
relationship with paying readers, and your catalogue is positioned as licensable
IP — not just free content.

---

## 3. TALEROOMS for Content Consumers (Readers)

If you read, TALEROOMS is built to help you find stories worth your time and pick
up exactly where you left off.

What you can do today:

- **Discover** a personalised feed based on your favourite genres, plus search
  for stories, genres and authors (by `$handle`).
- **Buy access your way** — the whole story, or just the chapters you want, for
  a duration that suits you (an hour, a day, a week, a year, or forever).
- **Subscribe** to an author you love for all‑access to their work.
- **Read comfortably** — pick chapters with buttons, and long chapters paginate
  into pages.
- **Continue where you left off** — your home page offers a "Continue from
  there" prompt for the chapter you last opened.
- **Bookmark by selection** — highlight a word or line in a chapter to save your
  spot, then jump straight back to it next time.
- **Collections** — group stories into your own named collections (like
  playlists) and share a collection via a link or to social networks.
- **Engage** — like/dislike, comment, follow authors, and express support.
- **Personalise** — a profile picture, themes, accent colours and a custom
  reading wallpaper.

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js (App Router)** with React + TypeScript |
| Styling | **Tailwind CSS v4** (account‑synced themes / accents) |
| Database | **PostgreSQL** with `pgvector` (embeddings) and `pg_trgm` (fuzzy search) |
| DB access | **postgres.js** |
| Auth | **better‑auth** (email + password, sessions) |
| Rich‑text editor | **TipTap** |
| Originality / similarity | **@huggingface/transformers** (local text embeddings) + lexical similarity |
| Image processing | **sharp** (re‑encode uploads to WebP) |
| Payments | **Mock payment layer** (to be replaced — see Future Additions) |

Conventions: SQL migrations live in `db/` and are applied in order; the app runs
fully server‑rendered with React Server Components and targeted client
components.

---

## 5. Pricing Models

All payments are currently **mocked** (no real money moves yet).

- **Per‑chapter purchase.** Each chapter can be individually priced. Readers buy
  only the chapters they want.
- **Whole‑story bundle.** A single price unlocks every chapter of a story,
  including chapters added later.
- **Time‑limited access (rentals).** A reader chooses how long they get access
  when they buy: **1 hour / 1 day / 1 week / 1 year / Always**. Access expires
  automatically after the chosen window (Always never expires). Authors set a
  price for each duration they offer.
- **Author subscriptions.** Each author sets **their own** subscription price. A
  subscription is an **all‑access pass** to that author's private chapters,
  runs on a **30‑day term**, and is **additive** (one‑off buying still works).
  Cancelling keeps access until the paid period ends.
- **Free / public chapters.** Authors may make any story's chapters public and
  free to read.

---

## 6. Important Note — Copyright

**Deepak Prasath Natarajan holds the complete copyright of this application.**
Any copy of the application, or of any of its features, will be faced legally.

---

## 7. Note to Contributors

Interested developers are welcome to contribute. Please **add your changes via
feature branches** (one branch per change/feature) and open them for review —
do not commit directly to the main branch.

---

## 8. Note to Investors

If you like what TALEROOMS is building, please reach out to
**n.deepakp@gmail.com**.

---

## 9. Future Additions

1. **Studio / producer access.** Producers such as Warner Bros, Netflix, Amazon
   Prime, Lionsgate and AGS Cinemas will be able to browse content, contact the
   author, and buy full copyright for mainstream cinema or series adaptation.
2. **Real payments.** The current mock payment layer will be replaced with real
   payments supporting multiple modes.
3. **Author Q&A.** Regular Q&A sessions between authors and their readers.
4. **Author credibility score.** A democratic, reader‑driven score that reflects
   an author's standing in the community.
5. **Multi‑language support.** Read and write in multiple languages.
6. **AI assistance.** AI support for content creation and review.
7. **Collaborative stories.** Multiple contributors co‑authoring a single story.
8. **Weekly rankings.** A leaderboard of the most‑read content each week.
9. **More formats.** Genres expanding beyond prose into **lyrics, poems and
   ghazals**.
10. **Robust word lookups.** The in‑reader "Meaning" feature (highlight a word to
    see its definition) is currently English‑only and depends on an external
    service. dictionaryapi.dev is free/community‑run with no SLA — if it's slow or
    down, the card shows "Couldn't reach the dictionary." For a polished product
    you may later want a paid dictionary (Merriam‑Webster/Oxford) or a local
    wordlist, but this is a solid zero‑cost start.

---

© Deepak Prasath Natarajan. All rights reserved.
