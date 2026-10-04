// Diagrams and charts for the documentation page, drawn in the page's own ink
// so they follow light and dark mode.
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Books01Icon,
  DiceIcon,
  FilterHorizontalIcon,
  NeuralNetworkIcon,
  RankingIcon,
  ScissorIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { Chip, Figure } from "./parts";

const STEPS: [string, string, IconSvgElement][] = [
  ["Corpus", "17 novels and Simple English Wikipedia, as plain text", Books01Icon],
  ["Tokeniser", "Splits text into sentences and tokens", ScissorIcon],
  ["Models", "A suffix-array n-gram model and an LSTM network", NeuralNetworkIcon],
  ["Sampling", "Grows many candidate sentences around your word", DiceIcon],
  ["Filters", "Length, position, novelty, grammar, reading level", FilterHorizontalIcon],
  ["Ranking", "Keeps the candidates the model finds most probable", RankingIcon],
  ["Analysis", "Probabilities, sources and statistics for each sentence", Analytics01Icon],
];

export function Pipeline() {
  return (
    <Figure caption="The path from raw text to the sentences on your screen.">
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([name, detail, icon], index) => (
          <li key={name} className="relative flex flex-col gap-2 rounded-xl border p-3">
            <span className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-lg border border-foreground/30">
                <HugeiconsIcon icon={icon} strokeWidth={2} className="size-[18px]" />
              </span>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
            </span>
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs leading-5 text-muted-foreground">{detail}</span>
            {/* Where the next step is: below on one column, to the right on more. */}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="absolute -bottom-3 left-1/2 size-5 -translate-x-1/2 rounded-full border bg-background p-0.5 sm:hidden"
            />
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              className="absolute top-1/2 -right-3 z-10 hidden size-5 -translate-y-1/2 rounded-full border bg-background p-0.5 sm:block sm:[li:nth-child(2n)_&]:hidden lg:[li:nth-child(2n)_&]:block lg:[li:nth-child(4n)_&]:hidden"
            />
          </li>
        ))}
        <li className="flex flex-col justify-center gap-2 rounded-xl border-2 border-foreground p-3">
          <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-6" />
          <span className="text-sm font-semibold">Your sentences</span>
          <span className="text-xs leading-5 text-muted-foreground">Ranked, explained and ready to copy or export</span>
        </li>
      </ol>
    </Figure>
  );
}

const TOY = ["<s>", "the", "cat", "sat", ".", "</s>", "<s>", "the", "cat", "ran", ".", "</s>"];

/** The toy corpus above, its suffix array, and the range for "the cat". */
export function SuffixArray() {
  const key = (p: number) => [0, 1, 2].map((k) => TOY[p + k] ?? "");
  const order = TOY.map((_, p) => p).sort((x, y) => {
    const a = key(x).join("\u0000");
    const b = key(y).join("\u0000");
    return a < b ? -1 : a > b ? 1 : x - y;
  });
  const match = (p: number) => TOY[p] === "the" && TOY[p + 1] === "cat";
  return (
    <Figure caption='Top: a two-sentence corpus as one array of tokens. Bottom: every position sorted by the three tokens that start there. All occurrences of "the cat" end up next to each other, so two binary searches find them, and the token after each (sat, ran) is what can follow "the cat".'>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-1">
          {TOY.map((token, position) => (
            <Chip key={position} label={position} strong={match(position) || match(position - 1)}>
              {token}
            </Chip>
          ))}
        </div>
        <table className="w-full max-w-md text-left font-mono text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-normal">order index</th>
              <th className="py-1 pr-3 font-normal">position p</th>
              <th className="py-1 font-normal">tokens at p, p+1, p+2</th>
            </tr>
          </thead>
          <tbody>
            {order.map((position, index) => (
              <tr key={position} className={match(position) ? "bg-foreground text-background" : ""}>
                <td className="px-1 py-0.5 pr-3">{index}</td>
                <td className="py-0.5 pr-3">{position}</td>
                <td className="py-0.5">{key(position).filter(Boolean).join("  ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Figure>
  );
}

const GROWN: { token: string; step: number }[] = [
  { token: "<s>", step: 8 },
  { token: "the", step: 7 },
  { token: "old", step: 6 },
  { token: "man", step: 5 },
  { token: "crossed", step: 0 },
  { token: "the", step: 0 },
  { token: "river", step: 0 },
  { token: "at", step: 1 },
  { token: "night", step: 2 },
  { token: ".", step: 3 },
  { token: "</s>", step: 4 },
];

export function Growth() {
  return (
    <Figure caption='Growing a sentence around the seed "the": one occurrence of it is picked together with its two neighbours (black). Tokens are then added to the right until the end marker (steps 1–4), and to the left until the start marker (steps 5–8).'>
      <div className="flex flex-wrap gap-1">
        {GROWN.map(({ token, step }, index) => (
          <Chip key={index} strong={step === 0} muted={token.startsWith("<")} label={step === 0 ? "seed" : `step ${step}`}>
            {token}
          </Chip>
        ))}
      </div>
    </Figure>
  );
}

export function Pivot() {
  const sentence = ["the", "old", "man", "crossed", "the", "river", "."];
  const pivot = 5;
  const rewritten = [...sentence.slice(pivot), "<sep>", ...sentence.slice(0, pivot).reverse(), "<end>"];
  return (
    <Figure caption='The neural model is trained on sentences rewritten around a random pivot word: the pivot, the words after it, a separator, the words before it in reverse, and an end marker. Given only a seed word, it can therefore write both halves of a sentence.'>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-1">
          <span className="mr-2 text-xs text-muted-foreground">Sentence</span>
          {sentence.map((token, index) => (
            <Chip key={index} strong={index === pivot}>
              {token}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-1">
          <span className="mr-2 text-xs text-muted-foreground">Training sequence</span>
          {rewritten.map((token, index) => (
            <Chip key={index} strong={index === 0} muted={token.startsWith("<")}>
              {token}
            </Chip>
          ))}
        </div>
      </div>
    </Figure>
  );
}

/** Small multiples: one softmax over the same scores at three temperatures. */
export function Temperature() {
  const words = ["water", "the", "river", "sea", "light"];
  const logits = [3, 2.2, 1.6, 0.8, 0];
  const at = (temperature: number) => {
    const weights = logits.map((z) => Math.exp(z / temperature));
    const total = weights.reduce((sum, w) => sum + w, 0);
    return weights.map((w) => w / total);
  };
  return (
    <Figure caption="The same five scores turned into probabilities at three temperatures. Low temperature sharpens the distribution towards the top word; high temperature flattens it so unlikely words get picked more often.">
      <div className="grid gap-6 sm:grid-cols-3">
        {[0.5, 1, 1.5].map((temperature) => (
          <div key={temperature} className="flex flex-col gap-2">
            <p className="text-sm font-medium">T = {temperature}</p>
            <ul className="flex flex-col gap-1">
              {at(temperature).map((probability, index) => (
                <li key={words[index]} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                  <span>{words[index]}</span>
                  <span className="h-2 rounded-full bg-muted">
                    <span className="block h-2 rounded-full bg-foreground" style={{ width: `${probability * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {Math.round(probability * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Figure>
  );
}

/** Log-log rank-frequency plot of the corpus with a slope −1 reference line. */
export function Zipf({ points }: { points: { rank: number; count: number }[] }) {
  const width = 640;
  const height = 360;
  const margin = { left: 56, right: 16, top: 16, bottom: 40 };
  const maxRank = points.at(-1)!.rank;
  const maxCount = points[0].count;
  const x = (rank: number) =>
    margin.left + (Math.log10(rank) / Math.log10(maxRank)) * (width - margin.left - margin.right);
  const y = (count: number) =>
    margin.top + (1 - Math.log10(count) / Math.log10(maxCount)) * (height - margin.top - margin.bottom);
  const decades = (max: number) => Array.from({ length: Math.floor(Math.log10(max)) + 1 }, (_, i) => 10 ** i);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.rank).toFixed(1)},${y(p.count).toFixed(1)}`).join("");
  // Zipf's law predicts count ∝ 1/rank: a straight line of slope −1 here.
  const zipfEnd = Math.max(1, maxCount / maxRank);

  return (
    <Figure caption="Frequency of every word in the corpus against its rank (1 = most frequent), both on logarithmic axes. The dashed line is what Zipf's law predicts, frequency ∝ 1/rank. Hover a point for its numbers.">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[30rem] text-foreground" role="img" aria-label="Rank-frequency plot">
        {decades(maxRank).map((rank) => (
          <g key={`x${rank}`}>
            <line x1={x(rank)} x2={x(rank)} y1={margin.top} y2={height - margin.bottom} className="stroke-current opacity-10" />
            <text x={x(rank)} y={height - margin.bottom + 18} textAnchor="middle" className="fill-current text-[13px] opacity-60">
              {rank.toLocaleString("en")}
            </text>
          </g>
        ))}
        {decades(maxCount).map((count) => (
          <g key={`y${count}`}>
            <line x1={margin.left} x2={width - margin.right} y1={y(count)} y2={y(count)} className="stroke-current opacity-10" />
            <text x={margin.left - 8} y={y(count) + 4} textAnchor="end" className="fill-current text-[13px] opacity-60">
              {count.toLocaleString("en")}
            </text>
          </g>
        ))}
        <text x={(width + margin.left) / 2} y={height - 4} textAnchor="middle" className="fill-current text-[13px] opacity-60">
          rank
        </text>
        <text x={12} y={height / 2} textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`} className="fill-current text-[13px] opacity-60">
          occurrences
        </text>
        <line
          x1={x(1)}
          y1={y(maxCount)}
          x2={x(maxRank)}
          y2={y(zipfEnd)}
          className="stroke-current opacity-50"
          strokeWidth={1.5}
          strokeDasharray="5 5"
        />
        <text x={x(maxRank / 30)} y={y(maxCount / (maxRank / 30)) - 8} className="fill-current text-[13px] opacity-70">
          Zipf: 1/rank
        </text>
        <path d={line} fill="none" className="stroke-current" strokeWidth={2} />
        {points.map((p) => (
          <circle key={p.rank} cx={x(p.rank)} cy={y(p.count)} r={4} className="fill-current stroke-background" strokeWidth={2}>
            <title>{`rank ${p.rank.toLocaleString("en")}: ${p.count.toLocaleString("en")} occurrences`}</title>
          </circle>
        ))}
      </svg>
    </Figure>
  );
}
