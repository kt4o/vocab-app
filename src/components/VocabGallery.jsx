import { useState, useEffect, useMemo } from "react";

function isBearerToken(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
}

function getTier(intervalDays) {
  const d = Number(intervalDays) || 1;
  if (d < 4) return "spark";
  if (d < 15) return "forming";
  if (d < 60) return "known";
  return "mastered";
}

function getTierProgress(intervalDays) {
  const d = Number(intervalDays) || 1;
  if (d < 4) return d / 4;
  if (d < 15) return (d - 4) / 11;
  if (d < 60) return (d - 15) / 45;
  return Math.min((d - 60) / 120, 1);
}

const TIER_LABELS = {
  en: { spark: "Spark", forming: "Forming", known: "Known", mastered: "Mastered" },
  ja: { spark: "はじめ", forming: "なじみ", known: "既知", mastered: "習得" },
};

const TIERS = ["spark", "forming", "known", "mastered"];

export function VocabGallery({ authToken, locale, onBack }) {
  const tr = (en, ja) => locale === "ja" ? ja : en;
  const tierLabels = locale === "ja" ? TIER_LABELS.ja : TIER_LABELS.en;

  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterBookId, setFilterBookId] = useState("all");
  const [filterTier, setFilterTier] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    const headers = {};
    if (isBearerToken(authToken)) headers.Authorization = `Bearer ${authToken}`;
    fetch("/api/review/gallery", { credentials: "include", headers })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        const raw = data.words || [];
        const normalized = raw.map((w) => ({
          ...w,
          displayWord: w.displayWord || w.word || "",
          displayContext: w.displayContext || (Array.isArray(w.definitions) ? w.definitions[0] : "") || "",
        }));
        setWords(normalized);
        setLoading(false);
      })
      .catch(() => {
        setError(tr("Could not load your vocab library.", "単語ライブラリを読み込めませんでした。"));
        setLoading(false);
      });
  }, [authToken]);

  const books = useMemo(() => {
    const seen = new Map();
    words.forEach((w) => {
      if (!seen.has(w.bookId)) seen.set(w.bookId, w.bookName);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [words]);

  const tierCounts = useMemo(() => {
    const counts = { spark: 0, forming: 0, known: 0, mastered: 0 };
    words.forEach((w) => { counts[getTier(w.intervalDays)] += 1; });
    return counts;
  }, [words]);

  const troubleWords = useMemo(
    () => words.filter((w) => (w.lapseCount || 0) >= 3),
    [words]
  );

  const displayWords = useMemo(() => {
    let filtered = words;
    if (filterBookId !== "all") {
      filtered = filtered.filter((w) => w.bookId === filterBookId);
    }
    if (filterTier !== "all") {
      filtered = filtered.filter((w) => getTier(w.intervalDays) === filterTier);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.displayWord.toLowerCase().includes(q) ||
          w.displayContext.toLowerCase().includes(q)
      );
    }
    const sorted = [...filtered];
    if (sortBy === "alpha") {
      sorted.sort((a, b) => a.displayWord.localeCompare(b.displayWord));
    } else if (sortBy === "hardest") {
      sorted.sort((a, b) => (b.lapseCount || 0) - (a.lapseCount || 0));
    } else if (sortBy === "strongest") {
      sorted.sort((a, b) => (b.intervalDays || 0) - (a.intervalDays || 0));
    }
    return sorted;
  }, [words, filterBookId, filterTier, sortBy, searchQuery]);

  function handleCardClick(key) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  const pageHeader = (
    <div className="pageHeader">
      <button className="backBtn" aria-label={tr("Go back", "戻る")} onClick={onBack}>
        &times;
      </button>
      <h1>
        {tr("Vocab Library", "単語ライブラリ")}
        {words.length > 0 && (
          <span className="galleryTotalBadge">{words.length}</span>
        )}
      </h1>
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        {pageHeader}
        <div className="galleryLoadingState">
          <p className="galleryLoadingText">
            {tr("Loading your vocab library…", "単語ライブラリを読み込んでいます…")}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        {pageHeader}
        <p className="galleryErrorText">{error}</p>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="page">
        {pageHeader}
        <div className="emptyActionState">
          <div className="emptyActionIcon">✨</div>
          <h2>{tr("No words yet", "単語がまだありません")}</h2>
          <p className="emptyActionBody">
            {tr(
              "Complete an Adaptive Review session to start building your vocab library.",
              "アダプティブレビューを行うと、単語ライブラリが増えていきます。"
            )}
          </p>
        </div>
      </div>
    );
  }

  const showTroubleSection =
    troubleWords.length > 0 && filterTier === "all" && !searchQuery.trim();

  return (
    <div className="page galleryPage">
      {pageHeader}

      <div className="galleryTierBar">
        {TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            className={`galleryTierChip tier-${tier} ${filterTier === tier ? "isActive" : ""}`}
            onClick={() => setFilterTier(filterTier === tier ? "all" : tier)}
          >
            <span className="galleryTierChipDot" />
            <span className="galleryTierChipLabel">{tierLabels[tier]}</span>
            <span className="galleryTierChipCount">{tierCounts[tier]}</span>
          </button>
        ))}
      </div>

      <div className="galleryFilters">
        <input
          type="search"
          className="gallerySearchInput"
          placeholder={tr("Search words…", "単語を検索…")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {books.length > 1 && (
          <select
            className="settingsInput gallerySelectInput"
            value={filterBookId}
            onChange={(e) => setFilterBookId(e.target.value)}
          >
            <option value="all">{tr("All Books", "全ブック")}</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <select
          className="settingsInput gallerySelectInput"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="recent">{tr("Recent", "最近")}</option>
          <option value="alpha">{tr("A–Z", "五十音")}</option>
          <option value="hardest">{tr("Hardest", "難しい順")}</option>
          <option value="strongest">{tr("Strongest", "強い順")}</option>
        </select>
      </div>

      {showTroubleSection && (
        <div className="gallerySection">
          <h2 className="gallerySectionTitle">
            🔥 {tr("Trouble Words", "苦手な単語")}
            <span className="gallerySectionCount">{troubleWords.length}</span>
          </h2>
          <div className="galleryGrid">
            {troubleWords.map((w) => {
              const cardKey = `${w.bookId}:${w.chapterId}:${w.displayWord}`;
              return (
                <WordCard
                  key={cardKey}
                  word={w}
                  expanded={expandedKey === cardKey}
                  onClick={() => handleCardClick(cardKey)}
                  tierLabels={tierLabels}
                  locale={locale}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="gallerySection">
        {showTroubleSection && (
          <h2 className="gallerySectionTitle">
            ✨ {tr("All Words", "すべての単語")}
            <span className="gallerySectionCount">{displayWords.length}</span>
          </h2>
        )}
        {displayWords.length === 0 ? (
          <p className="galleryNoResults">
            {tr("No words match your filters.", "フィルターに一致する単語がありません。")}
          </p>
        ) : (
          <div className="galleryGrid">
            {displayWords.map((w) => {
              const cardKey = `${w.bookId}:${w.chapterId}:${w.displayWord}`;
              return (
                <WordCard
                  key={cardKey}
                  word={w}
                  expanded={expandedKey === cardKey}
                  onClick={() => handleCardClick(cardKey)}
                  tierLabels={tierLabels}
                  locale={locale}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function WordCard({ word, expanded, onClick, tierLabels, locale }) {
  const tier = getTier(word.intervalDays);
  const progress = getTierProgress(word.intervalDays);
  const tr = (en, ja) => locale === "ja" ? ja : en;

  return (
    <button
      type="button"
      className={`galleryCard tier-${tier}${expanded ? " isExpanded" : ""}${word.lapseCount >= 3 ? " isTrouble" : ""}`}
      onClick={onClick}
      aria-expanded={expanded}
    >
      <div className="galleryCardAccent" />
      <div className="galleryCardBody">
        <div className="galleryCardTop">
          <div className="galleryCardWordGroup">
            <span className="galleryCardWord">{word.displayWord}</span>
            {word.japaneseReading && word.languageMode === "ja_en" && (
              <span className="galleryCardReading">{word.japaneseReading}</span>
            )}
          </div>
          <span className={`galleryCardBadge tier-${tier}`}>{tierLabels[tier]}</span>
        </div>
        <div className="galleryMasteryBar">
          <div
            className={`galleryMasteryFill tier-${tier}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="galleryCardStats">
          <span title={tr("Reviews", "復習回数")}>× {word.dueCount}</span>
          {word.successStreak > 0 && (
            <span title={tr("Streak", "連続正解")}>🔥 {word.successStreak}</span>
          )}
          {word.lapseCount > 0 && (
            <span className="galleryStatLapse" title={tr("Lapses", "忘れた回数")}>
              ↩ {word.lapseCount}
            </span>
          )}
        </div>
        {expanded && (
          <div className="galleryCardExpanded">
            {word.displayContext && (
              <p className="galleryCardDefinition">{word.displayContext}</p>
            )}
            {word.exampleSentence && (
              <div className="galleryCardExample">
                <span className="galleryCardExampleText">{word.exampleSentence}</span>
                {word.exampleTranslation && (
                  <span className="galleryCardExampleTrans">{word.exampleTranslation}</span>
                )}
              </div>
            )}
            {!word.displayContext && !word.exampleSentence && (
              <p className="galleryCardNoDetail">
                {tr("No details available.", "詳細情報はありません。")}
              </p>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
