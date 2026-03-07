import { Router } from "express";
import { CEFR_WORDLIST } from "../../src/data/cefrWordlist.js";

export const wordsRouter = Router();

const allWords = Object.entries(CEFR_WORDLIST).flatMap(([level, words]) =>
  Array.from(words).map((word) => ({
    id: `${level.toLowerCase()}-${word}`,
    word,
    level: String(level).toLowerCase(),
  }))
);

wordsRouter.get("/", (req, res) => {
  const difficulty = String(req.query.difficulty || "").trim().toLowerCase();
  const query = String(req.query.q || "").trim().toLowerCase();

  const filtered = allWords.filter((entry) => {
    const matchDifficulty = difficulty ? entry.level === difficulty : true;
    const matchQuery = query ? entry.word.toLowerCase().includes(query) : true;
    return matchDifficulty && matchQuery;
  });

  res.json({
    count: filtered.length,
    words: filtered,
  });
});
