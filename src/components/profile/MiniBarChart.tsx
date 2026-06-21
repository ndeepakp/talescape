// A tiny dependency-free bar chart for the author analytics. Pure presentation
// (server component) — accent-coloured bars scaled to the series max, with a
// value above each bar and a label beneath.

export type ChartPoint = { label: string; value: number };

export function MiniBarChart({
  data,
  format = (n) => String(n),
  large = false,
}: {
  data: ChartPoint[];
  format?: (n: number) => string;
  large?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  // With many bars, only label roughly every (n/8)th one so they don't crowd.
  const step = Math.max(1, Math.ceil(data.length / (large ? 15 : 8)));
  const showValues = data.length <= (large ? 31 : 14);

  return (
    <div>
      <div className={"flex items-end gap-2 " + (large ? "h-80" : "h-32")}>
        {data.map((d, i) => {
          const pct = max > 0 ? Math.round((d.value / max) * 100) : 0;
          return (
            <div
              key={i}
              className="flex h-full flex-1 flex-col items-center justify-end"
              title={`${d.label}: ${format(d.value)}`}
            >
              <span
                className={
                  "mb-1 tabular-nums text-zinc-500 " + (large ? "text-xs" : "text-[10px]")
                }
              >
                {showValues && d.value > 0 ? format(d.value) : ""}
              </span>
              <div
                className={
                  "w-full rounded-t bg-accent " + (large ? "max-w-[48px]" : "max-w-[32px]")
                }
                style={{ height: `${pct}%`, minHeight: d.value > 0 ? "2px" : "0" }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d, i) => (
          <span
            key={i}
            className="flex-1 overflow-hidden text-center text-[10px] text-zinc-400 dark:text-zinc-500"
          >
            {i % step === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
