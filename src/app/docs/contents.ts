// The documentation's sections, in order. The page, its contents list and
// each section's heading all read from here.
import {
  Analytics01Icon,
  Books01Icon,
  Bug01Icon,
  ChartLineData01Icon,
  Coffee02Icon,
  DiceIcon,
  FilterHorizontalIcon,
  Idea01Icon,
  NeuralNetworkIcon,
  Plant02Icon,
  RankingIcon,
  Route01Icon,
  ScissorIcon,
  SortingAZ01Icon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

export type Entry = { id: string; title: string; icon: IconSvgElement; blurb: string };

export const CONTENTS: Entry[] = [
  { id: "backstory", title: "Why this exists", icon: Coffee02Icon, blurb: "A college project that got out of hand" },
  { id: "overview", title: "The idea in one picture", icon: Idea01Icon, blurb: "What a language model is, and the twist here" },
  { id: "approach", title: "The approach", icon: Route01Icon, blurb: "The decisions, and what I said no to" },
  { id: "tokens", title: "From text to tokens", icon: ScissorIcon, blurb: "Cutting text into sentences and words" },
  { id: "language-models", title: "Language models", icon: DiceIcon, blurb: "Probabilities of the next word, from counts" },
  { id: "suffix-array", title: "Counting fast: the suffix array", icon: SortingAZ01Icon, blurb: "Any n-gram count in a few binary searches" },
  { id: "generation", title: "Growing a sentence", icon: Plant02Icon, blurb: "From your word outwards, in both directions" },
  { id: "scoring", title: "Scoring and ranking", icon: RankingIcon, blurb: "Interpolation, log-probability and perplexity" },
  { id: "neural", title: "The neural model", icon: NeuralNetworkIcon, blurb: "An LSTM that writes both halves of a sentence" },
  { id: "filters", title: "Filters", icon: FilterHorizontalIcon, blurb: "Length, position, grammar and reading level" },
  { id: "analysis", title: "The analysis numbers", icon: Analytics01Icon, blurb: "Sources, rare words, PMI and edit distance" },
  { id: "zipf", title: "Zipf's law in this corpus", icon: ChartLineData01Icon, blurb: "Word frequency against rank, live" },
  { id: "code", title: "How a request flows through the code", icon: SourceCodeIcon, blurb: "From the button to the sentences" },
  { id: "bloopers", title: "Things that went wrong", icon: Bug01Icon, blurb: "The blooper reel, so you don't repeat it" },
  { id: "references", title: "References", icon: Books01Icon, blurb: "Papers and books behind each idea" },
];

export function entry(id: string): Entry & { number: number } {
  const index = CONTENTS.findIndex((item) => item.id === id);
  return { ...CONTENTS[index], number: index + 1 };
}
