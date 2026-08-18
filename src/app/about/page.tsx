export default function AboutPage() {
  return (
    <div className="page-shell content-page">
      <p className="eyebrow">About the project</p>
      <h1>A public reference for sound change</h1>
      <p>
        CASC—the Corpus of Attested Sound Changes—records historically attested sound changes as structured, readable evidence. It is designed for historical linguists, language learners, conlangers, and anyone interested in comparing how sound systems change over time.
      </p>
      <p>
        CASC should not be treated as a complete diachronic guide to any language. It is a reference collection of individual attested sound changes, not a comprehensive reconstruction of every stage between an ancestor language and its descendants. Some changes may be missing, and the absence of a change from the corpus does not mean that it did not occur.
      </p>
      <p>
        CASC is still in early beta. Its data, structure, and presentation are actively being developed, and some entries may contain errors, incomplete information, or inconsistent formatting.
      </p>
      <p>
        The corpus is open to contributions. Anyone can help by providing reliable sources, correcting mistakes, improving existing entries, or suggesting changes to the project’s structure and documentation.
      </p>
      <aside className="contribute-callout" aria-labelledby="contribute-heading">
        <div>
          <p className="eyebrow">Want to contribute?</p>
          <h2 id="contribute-heading">Help shape the corpus.</h2>
        </div>
        <a className="discord-button" href="#">
          Join Discord <span aria-hidden="true">↗</span>
        </a>
      </aside>
    </div>
  );
}
