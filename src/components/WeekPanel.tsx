export type WeekStats = {
  name: string | null;
  storiesRead: number;
  quizzesTaken: number;
  quizScore: number; // 0–100, average correct
  answers: number;
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 py-2 dark:bg-zinc-900">
      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

// "Your week" — a reader's last-7-days activity, shown in the feed's right rail.
export function WeekPanel({ stats }: { stats: WeekStats }) {
  const active = stats.storiesRead + stats.quizzesTaken + stats.answers > 0;
  const first = (stats.name ?? "You").trim().split(/\s+/)[0] || "You";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Your week</p>
        <span className="text-xs text-zinc-400">last 7 days</span>
      </div>

      {active ? (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          {first}, you read <strong>{stats.storiesRead}</strong>{" "}
          {stats.storiesRead === 1 ? "story" : "stories"}
          {stats.quizzesTaken > 0 && (
            <>
              {" "}
              and scored <strong>{stats.quizScore}%</strong> on quizzes
            </>
          )}{" "}
          this week. 🎉
        </p>
      ) : (
        <p className="mt-1 text-sm text-zinc-500">
          Open a story to start your week. 📖
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat value={stats.storiesRead} label="read" />
        <Stat value={stats.quizzesTaken} label="quizzes" />
        <Stat value={stats.answers} label="answers" />
      </div>

      {stats.quizzesTaken > 0 && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${stats.quizScore}%` }}
          />
        </div>
      )}
    </div>
  );
}
