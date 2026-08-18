import type { Catalog, CatalogExample, CatalogNode, CatalogRule, CatalogTransition } from "@/db/queries";
import { PairEditor } from "./PairEditor";
import { DeletedRule, InlineReview, reviewClass, ruleReviewTargets, type BrowseChange } from "./BrowseInlineReview";

type DeletedRuleData = ReturnType<typeof import("./BrowseInlineReview").deletedRulesForTransition>[number];
type Props = { entry: CatalogTransition; nodes?: CatalogNode[]; compact?: boolean; canEdit?: boolean; reviewChanges?: BrowseChange[]; catalog?: Catalog; deletedRules?: DeletedRuleData[] };

export function EntryView({ entry, nodes = [], canEdit = false, reviewChanges = [], catalog, deletedRules = [] }: Props) {
  return <article className="entry">
    <ol className="rule-list">{entry.rules.map((rule) => <RuleView key={rule.id} rule={rule} targets={ruleReviewTargets(rule, reviewChanges)} catalog={catalog} />)}
      {catalog && deletedRules.map(({ change, item, snapshot }) => <DeletedRule key={`${change.id}-${item.id}`} change={change} item={item} snapshot={snapshot} catalog={catalog} />)}
    </ol>
    {canEdit && <PairEditor entry={entry} nodes={nodes} />}
  </article>;
}

function RuleView({ rule, targets, catalog }: { rule: CatalogRule; targets: ReturnType<typeof ruleReviewTargets>; catalog?: Catalog }) {
  return <li className={`rule ${reviewClass(targets)}`}><div className="rule-heading"><span className="rule-notation">{rule.displayNotation}</span>
    {rule.exceptionExamples.length > 0 && <WordDisclosure label="Exceptions" words={rule.exceptionExamples} />}
    {rule.examples.length > 0 && <details className="examples-disclosure"><summary>Examples</summary><div className="examples-list">{rule.examples.map((example) => <ExampleView key={example.id} example={example} />)}</div></details>}
  </div>{rule.explanation && <p className="rule-explanation">{rule.explanation}</p>}{catalog && <InlineReview targets={targets} catalog={catalog} />}</li>;
}

function WordDisclosure({ label, words }: { label: string; words: string[] }) {
  return <details className="examples-disclosure"><summary>{label}</summary><div className="examples-list">{words.map((word) => <a className="example" key={word} href={`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`} target="_blank" rel="noopener noreferrer external">{word}</a>)}</div></details>;
}

function ExampleView({ example }: { example: CatalogExample }) {
  const url = example.targetWiktionaryUrl || `https://en.wiktionary.org/wiki/${encodeURIComponent(example.targetForm)}`;
  return <a className="example" href={url} target="_blank" rel="noopener noreferrer external">{example.targetReconstructed ? "*" : ""}{example.targetForm}</a>;
}
