// Single-series, single-ink charts: one bar list and one histogram.

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export type Bar = { label: string; value: number; display?: string };

/** Horizontal bars with the label and value written out on every row. */
export function BarList({ bars, max }: { bars: Bar[]; max?: number }) {
  const top = max ?? Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <ul className="flex flex-col gap-1.5">
      {bars.map((bar) => (
        <li key={bar.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2 text-sm">
          <span className="truncate" title={bar.label}>
            {bar.label}
          </span>
          <span className="h-2 rounded-full bg-muted">
            <span
              className="block h-2 min-w-0.5 rounded-full bg-foreground"
              style={{ width: `${Math.min(100, (bar.value / top) * 100)}%` }}
            />
          </span>
          <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
            {bar.display ?? compact.format(bar.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Vertical bars over ordered buckets; the count shows above each bar. */
export function Histogram({ bars }: { bars: Bar[] }) {
  const top = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <div className="flex h-44 items-stretch gap-0.5" role="img" aria-label="Histogram">
      {bars.map((bar) => (
        <div
          key={bar.label}
          className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
          title={`${bar.label} words: ${bar.value.toLocaleString("en")} sentences`}
        >
          <span className="text-[0.65rem] text-muted-foreground tabular-nums max-sm:hidden group-hover:text-foreground">
            {compact.format(bar.value)}
          </span>
          <span
            className="w-full min-h-0.5 rounded-t bg-foreground/85 group-hover:bg-foreground"
            style={{ height: `${(bar.value / top) * 75}%` }}
          />
          <span className="text-[0.6rem] whitespace-nowrap text-muted-foreground tabular-nums sm:text-[0.65rem]">
            {bar.label}
          </span>
        </div>
      ))}
    </div>
  );
}
