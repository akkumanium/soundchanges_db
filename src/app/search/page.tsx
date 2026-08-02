import { getCatalog } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [params, catalog] = await Promise.all([searchParams, getCatalog()]);
  const input = normalize(params.input);
  const output = normalize(params.output);
  const phoneme = normalize(params.phoneme);
  const hasSearch = Boolean(input || output || phoneme);
  const matches = hasSearch ? catalog.transitions.flatMap((entry) => entry.rules
    .filter((rule) => phoneme ? rule.input.includes(phoneme) || rule.output.includes(phoneme) : (!input || matchesSound(rule.input, input)) && (!output || matchesSound(rule.output, output)))
    .map((rule) => ({ entry, rule }))) : [];
  const searchDescription = phoneme ? `sound changes involving ${phoneme}` : [input || "any sound", output || "any sound"].join(" → ");

  return <div className="page-shell">
    <header className="page-intro page-intro--small"><p className="eyebrow">Catalog search</p><h1>Search</h1></header>
    <form className="search-filters" action="/search" role="search">
      <div className="form-field"><label htmlFor="input">First sound</label><input id="input" name="input" type="search" defaultValue={input} autoFocus placeholder="e.g. t" /></div>
      <div className="form-field"><label htmlFor="output">Second sound</label><input id="output" name="output" type="search" defaultValue={output} placeholder="e.g. s" /></div>
      <button type="submit">Search</button>
    </form>
    <p className="search-help">Enter one or both sounds to find exact input → output correspondences. Leave either field empty to match any sound in that position.</p>
    {hasSearch && <p>{matches.length} {matches.length === 1 ? "result" : "results"} for <strong>{searchDescription}</strong></p>}
    <ul className="search-results">
      {matches.map(({ entry, rule }) => <li className={`search-result${rule.approvalStatus === "pending" ? " search-result--pending" : ""}`} key={rule.id}><p className="eyebrow">{entry.sourceName} → {entry.targetName}</p><p className="match-rule">{rule.displayNotation}{rule.approvalStatus === "pending" && <span className="pending-label">Pending review</span>}</p>{rule.explanation && <p>{rule.explanation}</p>}</li>)}
    </ul>
    {hasSearch && !matches.length && <p className="empty-state">No published sound changes match this search.</p>}
    <IpaTable />
  </div>;
}

function normalize(value: string | undefined) {
  return (value ?? "").normalize("NFC").trim();
}

// A rule may record several alternative sounds in one side, such as “ʁ, ɣ”.
// Each comma-separated item remains an exact searchable correspondence.
function matchesSound(ruleSide: string, sound: string) {
  return ruleSide === sound || ruleSide.split(",").some((item) => item.trim() === sound);
}

const consonants = [
  ["", "Bilabial", "Labiodental", "Dental", "Alveolar", "Postalveolar", "Retroflex", "Palatal", "Velar", "Uvular", "Pharyngeal", "Glottal"],
  ["Plosive", "p b", "", "", "t d", "", "ʈ ɖ", "c ɟ", "k ɡ", "q ɢ", "", "ʔ"],
  ["Nasal", "m", "ɱ", "", "n", "", "ɳ", "ɲ", "ŋ", "ɴ", "", ""],
  ["Trill", "ʙ", "", "", "r", "", "", "", "", "ʀ", "", ""],
  ["Tap or flap", "ⱱ̟", "ⱱ", "", "ɾ", "", "ɽ", "", "", "", "", ""],
  ["Fricative", "ɸ β", "f v", "θ ð", "s z", "ʃ ʒ", "ʂ ʐ", "ç ʝ", "x ɣ", "χ ʁ", "ħ ʕ", "h ɦ"],
  ["Lateral fricative", "", "", "", "ɬ ɮ", "", "", "", "", "", "", ""],
  ["Approximant", "", "ʋ", "", "ɹ", "", "ɻ", "j", "ɰ", "", "", ""],
  ["Lateral approximant", "", "", "", "l", "", "ɭ", "ʎ", "ʟ", "", "", "", ""],
];

const vowels = [
  ["", "Front", "Central", "Back"],
  ["Close", "i y", "ɨ ʉ", "ɯ u"],
  ["Near-close", "ɪ ʏ", "", "ɯ̽ ʊ"],
  ["Close-mid", "e ø", "ɘ ɵ", "ɤ o"],
  ["Mid", "", "ə", ""],
  ["Open-mid", "ɛ œ", "ɜ ɞ", "ʌ ɔ"],
  ["Near-open", "æ", "ɐ", ""],
  ["Open", "a ɶ", "ä", "ɑ ɒ"],
];

function IpaTable() {
  return <section className="ipa-table" aria-labelledby="ipa-heading"><h2 id="ipa-heading">IPA chart</h2><p>Click a phoneme to find every sound change that involves it.</p><IpaGrid title="Pulmonic consonants" rows={consonants} /><IpaGrid title="Vowels" rows={vowels} /><div className="ipa-other"><h3>Other symbols</h3>{["ʍ", "w", "ɥ", "ɕ", "ʑ", "ʎ̝", "ʟ̝", "ǀ", "ǃ", "ǂ", "ǁ", "ɓ", "ɗ", "ʄ", "ɠ", "ʛ", "ʼ", "ˈ", "ˌ", "ː", "ˑ", "̥", "̬", "ʰ", "ʷ", "ʲ", "ˠ", "ˤ", "ⁿ", "ˡ"].map((symbol) => <IpaLink key={symbol} symbol={symbol} />)}</div></section>;
}

function IpaGrid({ title, rows }: { title: string; rows: string[][] }) {
  return <section className="ipa-grid-section"><h3>{title}</h3><div className="ipa-grid" role="table" aria-label={title}>{rows.map((row, index) => <div className="ipa-row" role="row" key={row[0] || index}>{row.map((cell, cellIndex) => <div className={index === 0 || cellIndex === 0 ? "ipa-cell ipa-cell--label" : "ipa-cell"} role={index === 0 || cellIndex === 0 ? "columnheader" : "cell"} key={`${cell}-${cellIndex}`}>{index === 0 || cellIndex === 0 ? cell : cell.split(" ").map((symbol) => <IpaLink key={symbol} symbol={symbol} />)}</div>)}</div>)}</div></section>;
}

function IpaLink({ symbol }: { symbol: string }) {
  return <a className="ipa-symbol" href={`/search?phoneme=${encodeURIComponent(symbol)}`}>{symbol}</a>;
}
