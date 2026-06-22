import { getJapaneseWordMeta } from "../lib/japaneseText";

export function JapaneseWordDisplay({ wordEntry, className = "", showRomaji = true }) {
  const meta = getJapaneseWordMeta(wordEntry);
  const word = String(wordEntry?.word || "").trim();

  if (!meta) return <span className={className}>{word}</span>;

  const hasFurigana = meta.reading && meta.reading !== meta.word;
  const canShowRomaji = showRomaji && meta.romaji && meta.romaji !== meta.word && meta.romaji !== meta.reading;

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
      {canShowRomaji ? <span className="japaneseRomajiText">{meta.romaji}</span> : null}
    </span>
  );
}
