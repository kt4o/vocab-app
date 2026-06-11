import fs from "node:fs";
import path from "node:path";

const sourceDir = path.resolve(process.argv[2] || process.env.JLPT_WORD_LIST_SOURCE_DIR || "C:/tmp/jlpt-word-list/src");
const targetPath = path.resolve("src/data/japaneseStarterBook.js");
const sourceLicensePath = path.resolve(process.argv[3] || process.env.JLPT_WORD_LIST_LICENSE_PATH || path.join(sourceDir, "../LICENSE"));
const targetCount = 1500;
const initialActiveCount = 20;
const reviewOrderSeed = 1500;
const usefulFirstTerms = [
  "私",
  "あなた",
  "これ",
  "それ",
  "あれ",
  "ここ",
  "そこ",
  "あそこ",
  "今",
  "今日",
  "明日",
  "昨日",
  "朝",
  "昼",
  "夜",
  "時",
  "人",
  "友達",
  "家",
  "部屋",
  "学校",
  "先生",
  "学生",
  "会社",
  "仕事",
  "駅",
  "電車",
  "車",
  "道",
  "店",
  "お金",
  "水",
  "食べ物",
  "ご飯",
  "名前",
  "日本",
  "日本語",
  "英語",
  "行く",
  "来る",
  "帰る",
  "いる",
  "ある",
  "する",
  "見る",
  "聞く",
  "話す",
  "読む",
  "書く",
  "食べる",
  "飲む",
  "買う",
  "使う",
  "待つ",
  "分かる",
  "知る",
  "思う",
  "言う",
  "良い",
  "悪い",
  "大きい",
  "小さい",
  "新しい",
  "古い",
  "高い",
  "安い",
  "暑い",
  "寒い",
  "楽しい",
  "難しい",
  "簡単",
  "便利",
  "大丈夫",
  "好き",
  "嫌い",
  "多い",
  "少ない",
  "早い",
  "遅い",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
  "はい",
  "いいえ",
  "どうぞ",
  "ありがとう",
  "すみません",
  "お願いします",
];
const usefulFirstRankByTerm = new Map(usefulFirstTerms.map((term, index) => [term, index]));
const WINDOWS_1252_REVERSE_MAP = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function repairMojibake(value) {
  const text = String(value || "");
  if (!/[ÃãÂäåæçèéï]/.test(text)) return text;
  const bytes = [];
  for (const char of text) {
    const code = char.charCodeAt(0);
    bytes.push(WINDOWS_1252_REVERSE_MAP[code] ?? (code <= 255 ? code : 63));
  }
  return Buffer.from(bytes).toString("utf8");
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell);
  return cells.map((value) => value.trim());
}

function readLevel(level) {
  const filePath = path.join(sourceDir, `${level}.csv`);
  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  const [, ...rows] = lines;
  return rows
    .map((line) => {
      const [expression, reading, meaning] = parseCsvLine(line);
      return {
        expression: repairMojibake(expression),
        reading: repairMojibake(reading),
        meaning,
        level: level.toUpperCase(),
      };
    })
    .filter((entry) => entry.expression && entry.meaning);
}

function hashString(value, seed = 0) {
  let hash = 2166136261 ^ seed;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getUsefulFirstRank(entry) {
  const expressionRank = usefulFirstRankByTerm.get(entry.expression);
  if (Number.isInteger(expressionRank)) return expressionRank;
  const readingRank = usefulFirstRankByTerm.get(entry.reading);
  return Number.isInteger(readingRank) ? readingRank : null;
}

function buildUsefulReviewOrder(entry, index) {
  const levelBucket = entry.level === "N5" ? 0 : entry.level === "N4" ? 1 : 2;
  const reading = entry.reading || entry.expression;
  const readingBucket = hashString(reading.slice(0, 1), reviewOrderSeed) % 16;
  const wordBucket = hashString(`${entry.expression}:${entry.reading}`, reviewOrderSeed) % 97;
  const usefulFirstRank = getUsefulFirstRank(entry);

  if (Number.isInteger(usefulFirstRank)) {
    return usefulFirstRank * 100000 + wordBucket * 1000 + index;
  }

  return 10000000 + levelBucket * 1000000 + wordBucket * 10000 + readingBucket * 100 + index;
}

function spreadDuplicateExpressions(sortedWords) {
  const seenExpressions = new Set();
  const firstOccurrences = [];
  const duplicateOccurrences = [];

  for (const word of sortedWords) {
    const expression = String(word.word || "").trim();
    if (expression && seenExpressions.has(expression)) {
      duplicateOccurrences.push(word);
      continue;
    }

    if (expression) {
      seenExpressions.add(expression);
    }
    firstOccurrences.push(word);
  }

  return [...firstOccurrences, ...duplicateOccurrences];
}

const seenWords = new Set();
const entries = [];

for (const level of ["n5", "n4", "n3"]) {
  for (const entry of readLevel(level)) {
    const key = `${entry.expression}:${entry.reading}`.toLowerCase();
    if (seenWords.has(key)) continue;
    seenWords.add(key);
    entries.push(entry);
    if (entries.length >= targetCount) break;
  }
  if (entries.length >= targetCount) break;
}

const chapters = [
  { id: "jlpt-n5", name: "JLPT N5 Core" },
  { id: "jlpt-n4", name: "JLPT N4 Core" },
  { id: "jlpt-n3-starter", name: "N3 Starter Top-Up" },
];

const words = entries.map((entry, index) => {
  const chapterId =
    entry.level === "N5"
      ? "jlpt-n5"
      : entry.level === "N4"
        ? "jlpt-n4"
        : "jlpt-n3-starter";
  const definition = entry.meaning;
  return {
    word: entry.expression,
    pronunciation: entry.reading,
    japaneseReading: entry.reading,
    definitions: [definition],
    definition,
    languageMode: "ja_en",
    currentDefinitionIndex: 0,
    chapterId,
    meaningSource: "starter_jlpt_word_list",
    translationProvider: "jlpt-word-list",
    adaptiveReviewEnabled: index < initialActiveCount,
    starterReviewOrder: buildUsefulReviewOrder(entry, index),
  };
});

const sortedWords = spreadDuplicateExpressions(words.sort((a, b) => a.starterReviewOrder - b.starterReviewOrder));
sortedWords.forEach((word, index) => {
  word.adaptiveReviewEnabled = index < initialActiveCount;
  delete word.starterReviewOrder;
});

const payload = {
  id: "japanese-beginner-core-1500",
  name: "Japanese Beginner Core 1.5k",
  languageMode: "ja_en",
  sourceName: "jlpt-word-list",
  sourceUrl: "https://github.com/elzup/jlpt-word-list",
  sourceLicense: "MIT",
  sourceLicenseNotice: fs.readFileSync(sourceLicensePath, "utf8").trim(),
  sourceAttribution:
    "Vocabulary data adapted from elzup/jlpt-word-list, which credits chyyran/jlpt-anki-decks, jamsinclair/open-anki-jlpt-decks, and Tanos-based JLPT decks.",
  initialAdaptiveReviewActiveCount: initialActiveCount,
  chapters,
  words: sortedWords,
};

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(
  targetPath,
  `export const JAPANESE_STARTER_BOOK = ${JSON.stringify(payload, null, 2)};\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      targetPath,
      words: words.length,
      activeForAdaptiveReview: words.filter((word) => word.adaptiveReviewEnabled).length,
      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        words: words.filter((word) => word.chapterId === chapter.id).length,
      })),
    },
    null,
    2
  )
);
