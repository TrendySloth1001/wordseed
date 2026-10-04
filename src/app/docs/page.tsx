import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import "katex/dist/katex.min.css";
import { getModel, getNeuralModel } from "@/lib/corpus";
import { Growth, Pipeline, Pivot, SuffixArray, Temperature, Zipf } from "./diagrams";
import lstmCell from "./images/lstm-cell.png";
import markovChain from "./images/markov-chain.png";
import rnnUnfolded from "./images/rnn-unfolded.png";
import { Code, InCode, Section, Sub, Tex, WebFigure } from "./parts";

export const metadata: Metadata = {
  title: "How it works",
  description: "The mathematics and the code behind the sentence generator.",
};

const CONTENTS = [
  ["overview", "The idea in one picture"],
  ["tokens", "From text to tokens"],
  ["language-models", "Language models"],
  ["suffix-array", "Counting fast: the suffix array"],
  ["generation", "Growing a sentence"],
  ["scoring", "Scoring and ranking"],
  ["neural", "The neural model"],
  ["filters", "Filters"],
  ["analysis", "The analysis numbers"],
  ["zipf", "Zipf's law in this corpus"],
  ["code", "How a request flows through the code"],
  ["references", "References"],
];

const CC_BY_SA_4 = "https://creativecommons.org/licenses/by-sa/4.0/";
const CC_BY_SA_3 = "https://creativecommons.org/licenses/by-sa/3.0/";

export default async function DocsPage() {
  // The numbers below come from the corpus as it is now, uploads included.
  await connection();
  const [model, neural] = await Promise.all([getModel(), getNeuralModel()]);
  const { stats } = model;
  const positions = stats.tokens + 2 * stats.sentences;

  // Worked example: P(river | the longest) under the interpolated model.
  const c3 = model.ngramCount(["the", "longest", "river"]);
  const ctx2 = model.ngramCount(["the", "longest"]);
  const c2 = model.ngramCount(["longest", "river"]);
  const ctx1 = model.ngramCount(["longest"]);
  const c1 = model.ngramCount(["river"]);
  const p3 = ctx2 ? c3 / ctx2 : 0;
  const p2 = ctx1 ? c2 / ctx1 : 0;
  const p1 = c1 / positions;
  const interpolated = 0.5 * p3 + 0.3 * p2 + 0.2 * p1;
  const f = (value: number, digits = 4) => value.toFixed(digits);
  const n = (value: number) => value.toLocaleString("en");

  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-1 justify-center gap-10 px-4 py-6 sm:py-10">
      <nav className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] w-60 shrink-0 self-start overflow-y-auto lg:block print:hidden" aria-label="Contents">
        <p className="mb-2 text-sm font-semibold">Contents</p>
        <ol className="flex flex-col gap-1 text-sm">
          {CONTENTS.map(([id, title], index) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                {index + 1}. {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="flex min-w-0 max-w-3xl flex-1 flex-col gap-10 leading-7">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h1>
          <p className="text-lg text-muted-foreground">
            The mathematics behind each step of the sentence generator, and where each step lives in
            the code. Numbers marked <em>live</em> are computed from the corpus as it is right now:{" "}
            {n(stats.sentences)} sentences, {n(stats.tokens)} tokens and {n(stats.vocabulary)} distinct
            words.
          </p>
          <details className="rounded-lg border px-4 py-2 lg:hidden print:hidden">
            <summary className="cursor-pointer font-medium">Contents</summary>
            <ol className="mt-2 flex flex-col gap-1 text-sm">
              {CONTENTS.map(([id, title], index) => (
                <li key={id}>
                  <a href={`#${id}`} className="underline underline-offset-2">
                    {index + 1}. {title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        </header>

        <Section id="overview" title="1. The idea in one picture">
          <p>
            A <strong>language model</strong> assigns a probability to every possible next word given
            the words before it. Once you have that, writing a sentence is just repeated sampling: pick
            a likely next word, append it, repeat. This project builds two such models from scratch, a
            counting model (n-grams) and a small neural network (an LSTM), and adds one twist: the
            sentence has to contain <em>your</em> word, possibly in the middle. So instead of writing
            left to right from the start, it starts at your word and grows outwards in both
            directions.
          </p>
          <Pipeline />
        </Section>

        <Section id="tokens" title="2. From text to tokens">
          <p>
            Models work on <strong>tokens</strong>, not characters. A token here is a word (letters and
            digits, allowing inner apostrophes and hyphens, so <code>didn&apos;t</code> and{" "}
            <code>well-known</code> stay whole) or one of the punctuation marks{" "}
            <code>, ; : — . ! ?</code>. Text is first split into paragraphs, then into sentences at{" "}
            <code>. ! ?</code>, with a few repairs:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Abbreviations lose their full stop (<code>Mr. Darcy</code> → <code>Mr Darcy</code>), and{" "}
              <code>e.g.</code>/<code>i.e.</code> become &ldquo;for example&rdquo;/&ldquo;that is&rdquo;, so
              they do not end a sentence.
            </li>
            <li>
              A piece that starts in lowercase is glued to the one before it, so{" "}
              <em>&ldquo;What!&rdquo; he cried.</em> stays one sentence.
            </li>
            <li>Headings (no lowercase letters), non-Latin text and fragments under three tokens are dropped.</li>
            <li>Every sentence is wrapped in a start marker ⟨s⟩ and an end marker ⟨/s⟩.</li>
          </ul>
          <p>
            Capitals at the start of a sentence are ambiguous: <em>The</em> is just <em>the</em>, but{" "}
            <em>Anna</em> is a name. The rule used: lowercase the first word when that word is seen in
            lowercase somewhere mid-sentence, or when it is never seen mid-sentence at all; otherwise
            keep it. Formally, with <Tex>{String.raw`M`}</Tex> the set of tokens seen in non-initial
            positions, the first token <Tex>{String.raw`w`}</Tex> is replaced by{" "}
            <Tex>{String.raw`\operatorname{lower}(w)`}</Tex> iff{" "}
            <Tex>{String.raw`\operatorname{lower}(w) \in M \;\lor\; w \notin M`}</Tex>.
          </p>
          <InCode file="src/lib/text.ts">
            <code>tokenize()</code> does the splitting and <code>normalizeCapitals()</code> the capital
            rule. Both models, and the Python training script, use exactly this tokeniser, so they see
            identical tokens.
          </InCode>
        </Section>

        <Section id="language-models" title="3. Language models">
          <p>
            The probability of a whole sentence <Tex>{String.raw`w_1 w_2 \dots w_n`}</Tex> can always be
            written, exactly, with the <strong>chain rule</strong> of probability:
          </p>
          <Tex block>{String.raw`P(w_1, \dots, w_n) = \prod_{i=1}^{n} P(w_i \mid w_1, \dots, w_{i-1})`}</Tex>
          <p>
            The trouble is the conditioning: almost no long history ever repeats in a corpus, so these
            probabilities cannot be estimated directly. An <strong>n-gram model</strong> makes the{" "}
            <strong>Markov assumption</strong>: only the last <Tex>{String.raw`k`}</Tex> words matter.
          </p>
          <Tex block>{String.raw`P(w_i \mid w_1, \dots, w_{i-1}) \approx P(w_i \mid w_{i-k}, \dots, w_{i-1})`}</Tex>
          <p>
            With <Tex>{String.raw`k = 1`}</Tex> this is a bigram model, with{" "}
            <Tex>{String.raw`k = 2`}</Tex> a trigram model, and so on. The probabilities are estimated by{" "}
            <strong>counting</strong> (the maximum-likelihood estimate), where{" "}
            <Tex>{String.raw`c(\cdot)`}</Tex> is the number of times a sequence occurs in the corpus:
          </p>
          <Tex block>{String.raw`P_{\text{ML}}(w \mid a, b) = \frac{c(a, b, w)}{c(a, b)}`}</Tex>
          <p>
            A model like this is a <strong>Markov chain</strong>: the &ldquo;state&rdquo; is the last few
            words, and each step moves to a new state with fixed probabilities that depend only on the
            current one. The classic picture is a two-state chain:
          </p>
          <WebFigure
            image={markovChain}
            alt="A two-state Markov chain with states E and A and transition probabilities on the arrows"
            caption="A Markov chain with two states, E and A. Each arrow is labelled with the probability of moving along it, and the probabilities leaving a state add up to 1. In this project the states are word contexts and there are millions of them."
            credit="Joxemai4"
            source="https://commons.wikimedia.org/wiki/File:Markovkate_01.svg"
            license="CC BY-SA 3.0"
            licenseUrl={CC_BY_SA_3}
          />
          <p>
            Generation in this project uses contexts of up to three words, so its main model is a{" "}
            <strong>4-gram</strong> model <Tex>{String.raw`P(w \mid a, b, c)`}</Tex>, with shorter
            contexts as fallbacks (section 5). Scoring uses an interpolated trigram model (section 6).
          </p>
        </Section>

        <Section id="suffix-array" title="4. Counting fast: the suffix array">
          <p>
            Generating thousands of sentences needs millions of counts like{" "}
            <Tex>{String.raw`c(a, b, w)`}</Tex>. Storing a table of every n-gram would cost a lot of
            memory, so the model instead keeps two arrays over the{" "}
            {n(positions)} token positions (live):
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Tex>{String.raw`t`}</Tex>: the whole corpus as one array of token ids, sentences one after
              another with their markers.
            </li>
            <li>
              <Tex>{String.raw`\text{order}`}</Tex>: every position <Tex>{String.raw`p`}</Tex>, sorted by
              the triple <Tex>{String.raw`(t_p, t_{p+1}, t_{p+2})`}</Tex>. This is a suffix array cut
              off at depth 3.
            </li>
          </ul>
          <SuffixArray />
          <p>
            Because equal prefixes are adjacent after sorting, all occurrences of a context form one
            contiguous range of <Tex>{String.raw`\text{order}`}</Tex>. Two binary searches find its two
            ends, and the count is simply the length of the range:
          </p>
          <Tex block>{String.raw`c(a, b) = \mathit{hi} - \mathit{lo}, \qquad \text{found in } O(\log N) \text{ steps}`}</Tex>
          <p>
            The range for a single token is even cheaper: a bucket table{" "}
            <Tex>{String.raw`\text{first}[\,\mathit{id}\,]`}</Tex> (a running total of token counts)
            gives it in <Tex>{String.raw`O(1)`}</Tex>, and the binary searches for longer contexts run
            inside that bucket. Sorting costs <Tex>{String.raw`O(N \log N)`}</Tex> once, which takes
            about two seconds when the server starts.
          </p>
          <Code file="src/lib/sentence-model.ts · find()">{`
// Narrow [lo, hi) one context word at a time.
let lo = first[a], hi = first[a + 1];
for (let depth = 1; depth < n; depth++) {
  const want = depth === 1 ? b : c;
  const at = (i) => tokens[order[i] + depth];
  lo = lowerBound(lo, hi, i => at(i) >= want);  // first match
  hi = lowerBound(lo, hi, i => at(i) >  want);  // one past the last
}
return hi - lo;  // = c(a, b, c)
`}</Code>
        </Section>

        <Section id="generation" title="5. Growing a sentence">
          <Sub>Sampling is just picking a random occurrence</Sub>
          <p>
            To sample the next word after a context, the model picks one of the context&apos;s
            occurrences uniformly at random and takes the token that follows it there. Since{" "}
            <Tex>{String.raw`c(a,b,c,w)`}</Tex> of the <Tex>{String.raw`c(a,b,c)`}</Tex> occurrences are
            followed by <Tex>{String.raw`w`}</Tex>, the chance of getting <Tex>{String.raw`w`}</Tex> is
          </p>
          <Tex block>{String.raw`\Pr[\text{next} = w] = \frac{c(a, b, c, w)}{c(a, b, c)} = P_{\text{ML}}(w \mid a, b, c)`}</Tex>
          <p>
            which is exactly the maximum-likelihood distribution, without ever computing it. Going
            left works the same way with the token <em>before</em> each occurrence, giving a backward
            model <Tex>{String.raw`P(w \mid a, b, c)`}</Tex> for the word preceding{" "}
            <Tex>{String.raw`a\,b\,c`}</Tex>.
          </p>
          <Sub>Bidirectional growth</Sub>
          <p>
            The seed is a random occurrence of your word, so a word is seeded in proportion to how
            often each of its contexts appears. Its two neighbours come along, giving a three-token
            start. The sentence then grows rightwards using the last three tokens as context until it
            produces ⟨/s⟩, and leftwards using the first three until it produces ⟨s⟩.
          </p>
          <Growth />
          <Sub>Backoff and the creativity slider</Sub>
          <p>
            A three-word context seen only once has a single continuation, so following it only
            replays the original sentence. When <Tex>{String.raw`c(a,b,c) \le 1`}</Tex> the model
            therefore drops to a shorter context with some probability, controlled by the creativity
            setting <Tex>{String.raw`\gamma \in [0, 1]`}</Tex>:
          </p>
          <Tex block>{String.raw`\Pr[\text{use } (b, c)] = 0.55 + 0.45\,\gamma, \qquad \Pr[\text{then use } (c) \mid c(b,c) \le 1] = 0.35\,\gamma`}</Tex>
          <p>
            At <Tex>{String.raw`\gamma = 0`}</Tex> the model never falls back to a single word of
            context (safer grammar); at <Tex>{String.raw`\gamma = 1`}</Tex> it always leaves unique
            contexts and sometimes uses only one word of context (more surprising sentences).
          </p>
          <Sub>Steering towards several words</Sub>
          <p>
            With two or three words, the rarest one is the seed. At every step the model checks
            whether a still-missing word <Tex>{String.raw`x`}</Tex> can follow the current context:
            if <Tex>{String.raw`c(b, c, x) > 0`}</Tex> it takes <Tex>{String.raw`x`}</Tex> with
            probability 0.9, otherwise if <Tex>{String.raw`c(c, x) > 0`}</Tex> with probability 0.4.
            Attempts that end without every word are thrown away.
          </p>
          <Sub>Not just copying</Sub>
          <p>
            Each token remembers the corpus position it was taken from. Consecutive positions mean
            text was copied verbatim, so an attempt is rejected when its longest run of consecutive
            positions exceeds <Tex>{String.raw`\max(7, \lceil 0.6\,L \rceil)`}</Tex>, where{" "}
            <Tex>{String.raw`L`}</Tex> is its length in tokens. Sentences that match a corpus sentence
            exactly are rejected too.
          </p>
          <InCode file="src/lib/sentence-model.ts">
            <code>sampler()</code> picks seeds (also handling the start, middle and end positions), and{" "}
            <code>grow()</code> runs the two loops, the backoff, the steering and the copy check.
          </InCode>
        </Section>

        <Section id="scoring" title="6. Scoring and ranking">
          <p>
            Many more candidates are generated than you ask for (four times as many for the Markov
            model), and the best are kept. &ldquo;Best&rdquo; means most probable under a smoothed
            trigram model that mixes three estimates with fixed weights, a technique called{" "}
            <strong>linear interpolation</strong>:
          </p>
          <Tex block>{String.raw`\hat P(w \mid a, b) = 0.5\,\frac{c(a,b,w)}{c(a,b)} + 0.3\,\frac{c(b,w)}{c(b)} + 0.2\,\frac{c(w)}{N}`}</Tex>
          <p>
            The unigram term keeps every known word above zero, so one unusual word does not make the
            whole sentence impossible. <strong>Worked example (live):</strong> the probability of{" "}
            <em>river</em> after <em>the longest</em>, with <Tex>{String.raw`N = \text{${n(positions)}}`}</Tex>:
          </p>
          <Tex block>{String.raw`\begin{aligned}
\hat P(\text{river} \mid \text{the, longest}) &= 0.5 \cdot \tfrac{${c3}}{${ctx2}} + 0.3 \cdot \tfrac{${c2}}{${ctx1}} + 0.2 \cdot \tfrac{${c1}}{${positions}} \\
&= 0.5 \cdot ${f(p3)} + 0.3 \cdot ${f(p2)} + 0.2 \cdot ${f(p1, 6)} \\
&\approx ${f(interpolated)}
\end{aligned}`}</Tex>
          <p>
            A sentence&apos;s score is its average log-probability per token (the end marker counts as a
            token, so the model also judges where the sentence stops):
          </p>
          <Tex block>{String.raw`\text{score} = \frac{1}{n} \sum_{i=1}^{n} \log \hat P(w_i \mid w_{i-2}, w_{i-1})`}</Tex>
          <p>
            Averaging stops long sentences from being punished just for being long. The{" "}
            <strong>perplexity</strong> shown for each sentence is the same number turned back into a
            probability scale:
          </p>
          <Tex block>{String.raw`\text{PP} = \exp(-\text{score}) = \Big( \prod_{i=1}^{n} \hat P(w_i \mid w_{i-2}, w_{i-1}) \Big)^{-1/n}`}</Tex>
          <p>
            Read it as &ldquo;on average, the model was as unsure as if it had to choose between PP
            equally likely words at each step&rdquo;. Lower is more natural. Both engines&apos; sentences
            are measured with this same Markov model, so their perplexities are comparable.
          </p>
          <InCode file="src/lib/generate.ts">
            <code>generate()</code> oversamples, applies the filters, sorts by score and keeps the
            top <Tex>{String.raw`k`}</Tex>; <code>probability()</code> and{" "}
            <code>perplexity()</code> in <code>sentence-model.ts</code> implement the formulas above.
          </InCode>
        </Section>

        <Section id="neural" title="7. The neural model">
          <p>
            Counting cannot generalise: a context never seen is a dead end. A neural language model
            instead maps every word to a vector and learns a function from the history to a
            probability distribution, so similar contexts give similar predictions.
          </p>
          <Sub>Recurrent networks</Sub>
          <p>
            A <strong>recurrent neural network</strong> reads one token at a time and carries a
            hidden state <Tex>{String.raw`h_t`}</Tex>, a summary of everything read so far:
          </p>
          <WebFigure
            image={rnnUnfolded}
            alt="A recurrent neural network drawn as a loop, and unfolded into a chain of time steps"
            caption="Left: an RNN with its loop. Right: the same network unfolded over time; the same weights are reused at every step, and the hidden state h carries information forward."
            credit="fdeloche"
            source="https://commons.wikimedia.org/wiki/File:Recurrent_neural_network_unfold.svg"
            license="CC BY-SA 4.0"
            licenseUrl={CC_BY_SA_4}
          />
          <Sub>The LSTM cell</Sub>
          <p>
            Plain RNNs forget quickly because gradients shrink as they flow back through many steps.
            The <strong>long short-term memory</strong> cell adds a separate memory{" "}
            <Tex>{String.raw`c_t`}</Tex> and three gates that decide what to forget, what to write and
            what to output:
          </p>
          <WebFigure
            image={lstmCell}
            alt="An LSTM unit with its forget, input and output gates between the previous and next time steps"
            caption="One LSTM unit: the forget gate F, input gate I and output gate O control the cell memory c that runs along the top."
            credit="fdeloche"
            source="https://commons.wikimedia.org/wiki/File:Long_Short-Term_Memory.svg"
            license="CC BY-SA 4.0"
            licenseUrl={CC_BY_SA_4}
          />
          <Tex block>{String.raw`\begin{aligned}
i_t &= \sigma(W_i x_t + U_i h_{t-1} + b_i) && \text{input gate} \\
f_t &= \sigma(W_f x_t + U_f h_{t-1} + b_f) && \text{forget gate} \\
g_t &= \tanh(W_g x_t + U_g h_{t-1} + b_g) && \text{candidate memory} \\
o_t &= \sigma(W_o x_t + U_o h_{t-1} + b_o) && \text{output gate} \\
c_t &= f_t \odot c_{t-1} + i_t \odot g_t \\
h_t &= o_t \odot \tanh(c_t)
\end{aligned}`}</Tex>
          <p>
            Here <Tex>{String.raw`x_t = E[w_t]`}</Tex> is the embedding of the current token,{" "}
            <Tex>{String.raw`\sigma`}</Tex> is the logistic function and{" "}
            <Tex>{String.raw`\odot`}</Tex> is element-wise multiplication. This model has{" "}
            {neural ? n(neural.vocabulary.length) : "8,000"} words in its vocabulary (rarer words
            become ⟨unk⟩) and 256 numbers per vector and per hidden state.
          </p>
          <Sub>From hidden state to probabilities</Sub>
          <p>
            The next-token scores (logits) reuse the embedding matrix, a trick called{" "}
            <strong>weight tying</strong> that saves parameters and helps small models; softmax turns
            them into probabilities:
          </p>
          <Tex block>{String.raw`z = E\,h_t + b, \qquad P(w \mid \text{history}) = \operatorname{softmax}(z)_w = \frac{e^{z_w}}{\sum_{v} e^{z_v}}`}</Tex>
          <Sub>Writing in both directions with one network</Sub>
          <p>
            A normal language model only writes left to right, from the start of a sentence. To start
            at a word in the middle, every training sentence is rewritten around a random pivot:
          </p>
          <Pivot />
          <p>
            At generation time the network is given the seed word, writes the rest of the sentence,
            emits ⟨sep⟩ (forced after a full stop), then writes the beginning backwards until ⟨end⟩.
            The two halves are joined in reading order.
          </p>
          <Sub>Training</Sub>
          <p>
            Training minimises the <strong>cross-entropy</strong>, the average negative
            log-probability of each true next token:
          </p>
          <Tex block>{String.raw`\mathcal{L}(\theta) = -\frac{1}{T} \sum_{t=1}^{T} \log P_\theta(w_{t+1} \mid w_1, \dots, w_t)`}</Tex>
          <p>
            It runs for 12 passes over the corpus (with a new pivot for every sentence each pass),
            batches of 128 sequences, the Adam optimiser with a one-cycle learning-rate schedule
            peaking at 0.002, dropout of 0.3 and gradient clipping at 1. Two per cent of the sentences
            are held back; the perplexity on those,{" "}
            <Tex>{String.raw`\exp(\mathcal{L}_{\text{held-out}})`}</Tex>, is{" "}
            <strong>{neural ? neural.perplexity : "not available until trained"}</strong> (live), down
            from 8,000 for a model that knows nothing.
          </p>
          <Sub>Temperature and top-k sampling</Sub>
          <p>
            When writing, the logits are divided by a temperature <Tex>{String.raw`T`}</Tex> before the
            softmax, and only the 40 highest-scoring tokens are allowed (top-k sampling). The
            creativity slider sets <Tex>{String.raw`T = 0.5 + 0.7\,\gamma`}</Tex>. Words you asked for
            get a bonus of +4 on their logit until they appear, which multiplies their odds by{" "}
            <Tex>{String.raw`e^{4} \approx 55`}</Tex>.
          </p>
          <Tex block>{String.raw`P_T(w) = \frac{e^{z_w / T}}{\sum_{v \in \text{top-}k} e^{z_v / T}}`}</Tex>
          <Temperature />
          <InCode file="ml/train.py · src/lib/neural-model.ts">
            The network is trained in PyTorch (<code>ml/train.py</code>) and its weights are saved as
            raw numbers. The app runs it in TypeScript: <code>step()</code> is the LSTM equations
            above, <code>choose()</code> the temperature and top-k sampling, and{" "}
            <code>replay()</code> recomputes each word&apos;s probability for the Explain panel.
          </InCode>
          <Code file="src/lib/neural-model.ts · step()">{`
for (let row = 0; row < 4 * H; row++)          // all four gates at once
  gates[row] = bias[row] + dot(Wx[row], x) + dot(Wh[row], h);
for (let k = 0; k < H; k++) {
  const i = sigmoid(gates[k]),     f = sigmoid(gates[H + k]);
  const g = tanh(gates[2 * H + k]), o = sigmoid(gates[3 * H + k]);
  c[k] = f * c[k] + i * g;                     // c_t
  h[k] = o * tanh(c[k]);                       // h_t
}
for (let w = 0; w < V; w++)                    // tied output layer
  logits[w] = outputBias[w] + dot(E[w], h);
`}</Code>
        </Section>

        <Section id="filters" title="8. Filters">
          <p>Every candidate passes these checks, in order, before it can be ranked:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Length</strong>: words (not punctuation) between 4 and 30, or 3–8, 9–16, 17–32 for
              short, medium and long.
            </li>
            <li>
              <strong>Words and position</strong>: every requested word appears, and for a single word
              it is first, last or neither, as chosen.
            </li>
            <li>
              <strong>Novelty</strong>: it is not a sentence of the corpus word for word.
            </li>
            <li>
              <strong>Grammar</strong> (rule-based): every token gets a coarse part-of-speech tag from
              word lists (determiners, possessives, conjunctions, pronouns, forms of <em>be</em>,
              auxiliaries, modals, prepositions). Verbs are <em>learned from the corpus</em>: any word
              seen at least twice right after a modal (<em>would go</em>, <em>can see</em>) is taken
              as a base verb, and its inflections and a list of irregular forms are added. The
              sentence is rejected if it has no verb, ends on a word that needs a continuation
              (<em>the</em>, <em>my</em>, <em>and</em>, <em>because</em>…), or contains a pair that is
              never valid, such as a determiner before a preposition (<em>the of</em>) or two modals
              (<em>would can</em>).
            </li>
            <li>
              <strong>Reading level</strong>, using the Flesch reading-ease score of the sentence:
            </li>
          </ul>
          <Tex block>{String.raw`\text{FRE} = 206.835 - 1.015\,\frac{\text{words}}{\text{sentences}} - 84.6\,\frac{\text{syllables}}{\text{words}}`}</Tex>
          <p>
            With one sentence the middle term is just its word count. Syllables are estimated by
            counting groups of vowels, after removing a silent final <em>e</em>. &ldquo;Easy&rdquo;
            means <Tex>{String.raw`\text{FRE} \ge 70`}</Tex> and &ldquo;hard&rdquo;{" "}
            <Tex>{String.raw`\text{FRE} < 50`}</Tex>.
          </p>
          <InCode file="src/lib/grammar.ts · src/lib/readability.ts · src/lib/generate.ts">
            <code>explain()</code> returns the tags and the first broken rule, which the Statistics tab
            shows for rejected candidates; <code>readingEase()</code> is the formula above; the
            &ldquo;How the sentences were picked&rdquo; chart counts every candidate each filter
            removed.
          </InCode>
        </Section>

        <Section id="analysis" title="9. The analysis numbers">
          <Sub>Where the wording comes from</Sub>
          <p>
            A sentence is split greedily into the longest stretches that appear verbatim in the
            corpus: starting at the first token, extend while the extended phrase still occurs
            somewhere, record the source file of one occurrence, and continue after it. The longest
            such stretch, counted in words, is the &ldquo;longest copied run&rdquo;.
          </p>
          <Sub>Rare words and variety</Sub>
          <p>
            A word is rare when it occurs fewer than 5 times per million tokens. Variety is the{" "}
            <strong>type-token ratio</strong> of a batch of sentences:{" "}
            <Tex>{String.raw`\text{TTR} = |\{\text{distinct words}\}| \,/\, \text{total words}`}</Tex>.
          </p>
          <Sub>Similar words: pointwise mutual information</Sub>
          <p>
            Words that occur in the same contexts tend to mean similar things (the distributional
            hypothesis). How strongly a neighbour <Tex>{String.raw`c`}</Tex> is associated with a word{" "}
            <Tex>{String.raw`w`}</Tex>, beyond chance, is measured by positive pointwise mutual
            information:
          </p>
          <Tex block>{String.raw`\operatorname{PPMI}(w, c) = \max\!\Big(0,\; \log \frac{P(w, c)}{P(w)\,P(c)}\Big) = \max\!\Big(0,\; \log \frac{n(w,c)\,N}{c(w)\,c(c)}\Big)`}</Tex>
          <p>
            For your word, the 40 most telling neighbours on each side are kept, chosen by{" "}
            <Tex>{String.raw`\operatorname{PPMI} \cdot \log(1 + c(c))`}</Tex> so that both strong and
            common neighbours count. A candidate{" "}
            <Tex>{String.raw`x`}</Tex> sharing those neighbours scores the share of your word&apos;s
            association it matches:
          </p>
          <Tex block>{String.raw`\operatorname{sim}(w, x) = \frac{\sum_{c} \min\big(\operatorname{PPMI}(w,c),\, \operatorname{PPMI}(x,c)\big)}{\sum_{c} \operatorname{PPMI}(w,c)}`}</Tex>
          <p>
            Candidates must share at least three neighbours; function words are excluded. This is
            what turns <em>river</em> into <em>water, valley, delta, basin</em>.
          </p>
          <Sub>Suggestions for unknown words: edit distance</Sub>
          <p>
            A word missing from the corpus is first tried in related forms (<em>running</em> →{" "}
            <em>run</em>, <em>ran</em>), then compared with every known word by Levenshtein distance,
            the fewest insertions, deletions and substitutions turning one into the other:
          </p>
          <Tex block>{String.raw`d(i, j) = \min\begin{cases} d(i-1, j) + 1 \\ d(i, j-1) + 1 \\ d(i-1, j-1) + [a_i \ne b_j] \end{cases}`}</Tex>
          <p>
            Words within distance 1 (for words up to 4 letters) or 2 are offered, closest first and
            then most frequent.
          </p>
          <InCode file="src/lib/sentence-model.ts · src/lib/word-forms.ts">
            <code>segments()</code>, <code>rareShare()</code>, <code>similar()</code> and{" "}
            <code>suggest()</code> in the model; <code>relatedForms()</code> for the word-form
            fallback.
          </InCode>
        </Section>

        <Section id="zipf" title="10. Zipf's law in this corpus">
          <p>
            In almost every language, a word&apos;s frequency is roughly inversely proportional to its
            frequency rank, <Tex>{String.raw`f(r) \propto 1/r^{s}`}</Tex> with{" "}
            <Tex>{String.raw`s \approx 1`}</Tex>: the second most common word appears about half as
            often as the first. On log-log axes that is a straight line, since{" "}
            <Tex>{String.raw`\log f = \text{const} - s \log r`}</Tex>. Here it is for this corpus
            (live):
          </p>
          <Zipf points={model.rankFrequency()} />
          <p>
            This is why the models behave as they do: a handful of words (<em>the</em>,{" "}
            <em>and</em>, <em>of</em>) supply most contexts, while more than half of the vocabulary (56% right
            now) occurs only once or twice, so many contexts have a single continuation. That long tail is what
            the backoff rule and the neural model are there to handle.
          </p>
        </Section>

        <Section id="code" title="11. How a request flows through the code">
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              <code>src/app/generator.tsx</code> (browser) sends your words and settings to{" "}
              <code>POST /api/generate</code>.
            </li>
            <li>
              <code>src/app/api/generate/route.ts</code> validates them and calls{" "}
              <code>generate()</code> in <code>src/lib/generate.ts</code>.
            </li>
            <li>
              <code>getModel()</code> in <code>src/lib/corpus.ts</code> returns the trained n-gram
              model, building it the first time (and again whenever a corpus file changes).
            </li>
            <li>
              Unknown words fall back to related forms, then the chosen engine samples candidates,
              the filters run, and the best-scoring sentences are kept.
            </li>
            <li>
              Each sentence gets its numbers, and the run is saved to <code>data/runs/</code> by{" "}
              <code>src/lib/runs.ts</code>, so History and Explain can reopen it.
            </li>
            <li>
              Explain calls <code>/api/runs/[id]/sentences/[index]</code>, which recomputes
              probabilities, alternatives, tags and sources for that one sentence.
            </li>
          </ol>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Responsibility</th>
                </tr>
              </thead>
              <tbody className="[&_td]:px-3 [&_td]:py-2 [&_td:first-child]:font-mono [&_td:first-child]:text-xs [&_tr]:border-b last:[&_tr]:border-0">
                <tr><td>src/lib/text.ts</td><td>Tokeniser, capital rule, length settings</td></tr>
                <tr><td>src/lib/sentence-model.ts</td><td>Suffix array, n-gram sampling, scoring, analysis</td></tr>
                <tr><td>src/lib/neural-model.ts</td><td>LSTM inference, sampling and replay</td></tr>
                <tr><td>ml/train.py</td><td>Trains the LSTM in PyTorch and exports its weights</td></tr>
                <tr><td>src/lib/generate.ts</td><td>Oversampling, filters, ranking, run summary</td></tr>
                <tr><td>src/lib/grammar.ts</td><td>Part-of-speech tags and grammar rules</td></tr>
                <tr><td>src/lib/readability.ts</td><td>Syllables and Flesch reading ease</td></tr>
                <tr><td>src/lib/word-forms.ts</td><td>Inflections and irregular forms</td></tr>
                <tr><td>src/lib/runs.ts</td><td>Saved runs, ratings and the Explain breakdown</td></tr>
                <tr><td>src/lib/corpus.ts</td><td>Loading and caching models, uploads, sources</td></tr>
                <tr><td>src/lib/source-reader.ts</td><td>Paragraphs and phrase search for the reader</td></tr>
                <tr><td>scripts/</td><td>Downloading the corpus, exporting training sentences</td></tr>
                <tr><td>tests/</td><td>Unit tests (<code className="font-sans">npm test</code>)</td></tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="references" title="12. References">
          <ul className="list-disc space-y-2 pl-6 text-sm">
            <li>
              Jurafsky, D. and Martin, J. H. <em>Speech and Language Processing</em>, 3rd ed. draft,
              chapters on n-gram language models and RNNs/LSTMs.{" "}
              <a className="underline underline-offset-2" href="https://web.stanford.edu/~jurafsky/slp3/">web.stanford.edu/~jurafsky/slp3</a>
            </li>
            <li>
              Shannon, C. E. (1948). A mathematical theory of communication. <em>Bell System Technical Journal</em> 27. The first n-gram text generator.
            </li>
            <li>
              Manber, U. and Myers, G. (1993). Suffix arrays: a new method for on-line string searches.{" "}
              <em>SIAM Journal on Computing</em> 22(5).
            </li>
            <li>
              Hochreiter, S. and Schmidhuber, J. (1997). Long short-term memory. <em>Neural Computation</em> 9(8).
            </li>
            <li>
              Press, O. and Wolf, L. (2017). Using the output embedding to improve language models. <em>EACL</em>. (Weight tying.)
            </li>
            <li>
              Kingma, D. P. and Ba, J. (2015). Adam: a method for stochastic optimization. <em>ICLR</em>.
            </li>
            <li>
              Church, K. W. and Hanks, P. (1990). Word association norms, mutual information, and lexicography.{" "}
              <em>Computational Linguistics</em> 16(1).
            </li>
            <li>
              Flesch, R. (1948). A new readability yardstick. <em>Journal of Applied Psychology</em> 32(3).
            </li>
            <li>
              Levenshtein, V. I. (1966). Binary codes capable of correcting deletions, insertions, and reversals. <em>Soviet Physics Doklady</em> 10(8).
            </li>
            <li>Zipf, G. K. (1949). <em>Human Behavior and the Principle of Least Effort</em>. Addison-Wesley.</li>
            <li>
              Diagrams from Wikimedia Commons, credited under each image. Corpus: Project Gutenberg
              (public domain) and Simple English Wikipedia (CC BY-SA 4.0); see the{" "}
              <Link className="underline underline-offset-2" href="/corpus">Corpus</Link> page.
            </li>
          </ul>
        </Section>
      </article>
    </main>
  );
}
