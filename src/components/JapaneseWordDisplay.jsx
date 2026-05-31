import { getJapaneseWordMeta } from "../lib/japaneseText";

export function JapaneseWordDisplay({ wordEntry, className = "" }) {
  const meta = getJapaneseWordMeta(wordEntry);
  const word = String(wordEntry?.word || "").trim();

  if (!meta) return <span className={className}>{word}</span>;

  const hasFurigana = meta.reading && meta.reading !== meta.word;

  return (
    <span className={`japaneseWordDisplay ${className}`.trim()}>
      <span className="japaneseWordDisplayText">
        {hasFurigana ? (
          <ruby>
            {meta.word}
            <rt>{meta.reading}</rt>
          </ruby>
        ) : (
          meta.word
        )}
      </span>
    </span>
  );
}
