import type { CatalogExample, CatalogRule, CatalogTransition } from "@/db/queries";
import { PairEditor } from "./PairEditor";

type Props = { entry: CatalogTransition; compact?: boolean; canEdit?: boolean };

export function EntryView({ entry, canEdit = false }: Props) {
  return <article className="entry">
    <ol className="rule-list">{entry.rules.map((rule) => <RuleView key={rule.id} rule={rule} />)}</ol>
    {canEdit && <PairEditor entry={entry} />}
  </article>;
}

function RuleView({ rule }: { rule: CatalogRule }) {
  return <li className="rule"><div className="rule-heading"><span className="rule-notation">{rule.displayNotation}</span>
    {rule.exceptionExamples.length > 0 && <WordDisclosure label="Exceptions" words={rule.exceptionExamples} />}
    {rule.examples.length > 0 && <details className="examples-disclosure"><summary>Examples</summary><div className="examples-list">{rule.examples.map((example) => <ExampleView key={example.id} example={example} />)}</div></details>}
  </div>{rule.explanation && <p className="rule-explanation">{rule.explanation}</p>}</li>;
}

function WordDisclosure({ label, words }: { label: string; words: string[] }) {
  return <details className="examples-disclosure"><summary>{label}</summary><div className="examples-list">{words.map((word) => <a className="example" key={word} href={`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`} target="_blank" rel="noopener noreferrer external">{word}</a>)}</div></details>;
}

function ExampleView({ example }: { example: CatalogExample }) {
  const url = example.targetWiktionaryUrl || `https://en.wiktionary.org/wiki/${encodeURIComponent(example.targetForm)}`;
  return <a className="example" href={url} target="_blank" rel="noopener noreferrer external">{example.targetReconstructed ? "*" : ""}{example.targetForm}</a>;
}
