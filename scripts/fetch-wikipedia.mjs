// Downloads Simple English Wikipedia articles into data/corpus/ so the model
// knows modern, everyday vocabulary the classic novels lack. Wikipedia text is
// licensed CC BY-SA 4.0.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://simple.wikipedia.org/w/api.php";
const HEADERS = { "User-Agent": "nlp-project-corpus-builder/1.0 (educational project)" };
const HUB = "Wikipedia:List of articles all languages should have";

const MODERN = `Computer|Internet|Smartphone|Mobile phone|Email|Website|Software|Computer program|
Video game|Social media|Artificial intelligence|Machine learning|Robot|Television|Radio|Airplane|Car|
Electric car|Bicycle|Train|Bus|Motorcycle|Pizza|Coffee|Tea|Chocolate|Bread|Rice|Football|Basketball|
Cricket|Tennis|Baseball|Olympic Games|Music|Movie|Photography|Camera|Laptop|Computer keyboard|
Programming language|Python (programming language)|JavaScript|Google|Facebook|YouTube|Wikipedia|
Bank|Money|Credit card|Hospital|Physician|School|University|Teacher|Student|Office|Job|Business|
Company|Marketing|Advertising|Shopping|Supermarket|Restaurant|Hotel|Airport|Passport|Tourism|
Climate change|Global warming|Pollution|Recycling|Plastic|Electricity|Battery|Solar energy|Satellite|
Rocket|Astronaut|Space exploration|Moon landing|DNA|Vaccine|Virus|Bacteria|Vitamin|Exercise|Yoga|
Health|Medicine|Nurse|Dentist|Sleep|Dream|Emotion|Happiness|Friendship|Family|Marriage|Child|
Parent|Holiday|Birthday|Christmas|Diwali|Festival|Weather|Rain|Snow|Storm|Earthquake|Volcano|
Ocean|River|Mountain|Forest|Desert|Island|City|Village|Country|Government|Democracy|Election|
Law|Police|Court|Army|War|Peace|Newspaper|Magazine|Book|Library|Novel|Poetry|Language|English language|
Hindi|Alphabet|Dictionary|Mathematics|Science|Physics|Chemistry|Biology|Engineering|Technology|
Invention|Telephone|Light bulb|Engine|Bridge|Road|Building|House|Kitchen|Furniture|Clothing|Shoe|
Fashion|Color|Painting|Dance|Theatre|Guitar|Piano|Song|Singer|Actor|Animation|Cartoon|Comics|
Dog|Cat|Horse|Elephant|Tiger|Lion|Bird|Fish|Insect|Tree|Flower|Garden|Farm|Agriculture|Food|
Cooking|Fruit|Vegetable|Milk|Water|Sugar|Salt|Energy|Oil|Gold|Diamond|Iron|Glass|Paper|
Online shopping|Online chat|Blog|Search engine|Web browser|Operating system|Database|Computer network|
Wi-Fi|Bluetooth|Password|Computer virus|Hacker|Cryptocurrency|Bitcoin|Streaming media|Podcast|
India|United States|United Kingdom|China|Japan|Africa|Europe|Asia|Australia|Earth|Moon|Sun|Mars`
  .split("|")
  .map((title) => title.trim());



// Wikimedia rate-limits anonymous clients, so requests go out one at a time
// with a pause between them, and a 429 is waited out for as long as it asks.
let pause = 500;

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let attempt = 0; ; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pause));
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    if (attempt === 5) throw new Error(`HTTP ${res.status}`);
    if (res.status === 429) {
      pause = Math.min(pause * 1.5, 3000);
      const wait = Number(res.headers.get("retry-after")) || 30;
      await new Promise((resolve) => setTimeout(resolve, (wait + 1) * 1000));
    }
  }
}

async function hubTitles() {
  const titles = [];
  let plcontinue;
  do {
    const data = await api({
      action: "query",
      prop: "links",
      titles: HUB,
      plnamespace: "0",
      pllimit: "max",
      ...(plcontinue ? { plcontinue } : {}),
    });
    for (const link of data.query.pages[0].links ?? []) titles.push(link.title);
    plcontinue = data.continue?.plcontinue;
  } while (plcontinue);
  return titles;
}

/** Strips wiki markup from an article's source, keeping only its prose. */
function prose(wikitext) {
  let text = wikitext;
  const cut = text.search(
    /\n==+\s*(References|Related pages|Other websites|Notes|Sources|Further reading)\s*==+/i,
  );
  if (cut !== -1) text = text.slice(0, cut);

  text = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/<(gallery|math|timeline|syntaxhighlight|source|code|pre)[\s\S]*?<\/\1>/gi, "");

  // Templates and links nest, so peel them from the inside out.
  for (let previous; previous !== text; ) {
    previous = text;
    text = text
      .replace(/\{\{[^{}]*\}\}/g, "")
      .replace(/\[\[([^[\]]*)\]\]/g, (_, inner) =>
        /^(File|Image|Category|[a-z-]{2,12}):/i.test(inner) ? "" : inner.split("|").at(-1),
      );
  }

  return text
    .replace(/\{\|[\s\S]*?\|\}/g, "")
    .replace(/\[https?:[^\s\]]+ ?([^\]]*)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .split("\n")
    .map((line) => line.trim())
    // Keep paragraphs; drop headings, lists, table rows and leftovers.
    .filter((line) => line.length > 60 && !/^[=*#:;|!{}]|\[\[|\]\]|\{\{|\}\}/.test(line))
    .join("\n\n");
}

/** Fetches up to 50 articles in one request and returns their prose. */
async function articles(batch) {
  const data = await api({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    redirects: "1",
    titles: batch.join("|"),
  });
  return (data.query.pages ?? [])
    .map((page) => prose(page.revisions?.[0]?.slots?.main?.content ?? ""))
    .filter((text) => text.length > 400);
}

const titles = [...new Set([...MODERN, ...(await hubTitles())])];
console.log(`fetching ${titles.length} articles`);

const outDir = path.join(import.meta.dirname, "..", "data", "corpus");
await mkdir(outDir, { recursive: true });

const collected = [];
async function save() {
  await writeFile(path.join(outDir, "wikipedia-simple.txt"), collected.join("\n\n") + "\n");
}

for (let start = 0; start < titles.length; start += 50) {
  try {
    collected.push(...(await articles(titles.slice(start, start + 50))));
  } catch (error) {
    console.error(`skipped a batch: ${error.message}`);
  }
  // Save as we go so an interrupted run still leaves a usable corpus.
  await save();
  console.log(`${Math.min(start + 50, titles.length)}/${titles.length}`);
}

const size = collected.reduce((sum, text) => sum + text.length, 0);
console.log(`wikipedia-simple: ${collected.length} articles, ${(size / 1024).toFixed(0)} KB`);
