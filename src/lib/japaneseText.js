const HIRAGANA_START = 0x3041;
const KATAKANA_START = 0x30a1;

const DIGRAPH_ROMAJI = {
  きゃ: "kya",
  きゅ: "kyu",
  きょ: "kyo",
  ぎゃ: "gya",
  ぎゅ: "gyu",
  ぎょ: "gyo",
  しゃ: "sha",
  しゅ: "shu",
  しょ: "sho",
  じゃ: "ja",
  じゅ: "ju",
  じょ: "jo",
  ちゃ: "cha",
  ちゅ: "chu",
  ちょ: "cho",
  ぢゃ: "ja",
  ぢゅ: "ju",
  ぢょ: "jo",
  にゃ: "nya",
  にゅ: "nyu",
  にょ: "nyo",
  ひゃ: "hya",
  ひゅ: "hyu",
  ひょ: "hyo",
  びゃ: "bya",
  びゅ: "byu",
  びょ: "byo",
  ぴゃ: "pya",
  ぴゅ: "pyu",
  ぴょ: "pyo",
  みゃ: "mya",
  みゅ: "myu",
  みょ: "myo",
  りゃ: "rya",
  りゅ: "ryu",
  りょ: "ryo",
};

const KANA_ROMAJI = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  を: "o",
  ん: "n",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "ji",
  づ: "zu",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
  ゔ: "vu",
  ゐ: "wi",
  ゑ: "we",
  ぁ: "a",
  ぃ: "i",
  ぅ: "u",
  ぇ: "e",
  ぉ: "o",
};

function toHiragana(value) {
  return String(value || "").replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - KATAKANA_START + HIRAGANA_START)
  );
}

function doubleConsonant(value) {
  if (!value) return "";
  const first = value[0];
  return first === "c" ? "t" : first;
}

export function kanaToRomaji(value) {
  const kana = toHiragana(value).replace(/\s+/g, " ").trim();
  let result = "";
  let pendingSmallTsu = false;

  for (let index = 0; index < kana.length; index += 1) {
    const char = kana[index];
    if (char === "っ") {
      pendingSmallTsu = true;
      continue;
    }
    if (char === "ー") {
      const lastVowel = result.match(/[aeiou](?!.*[aeiou])/);
      if (lastVowel) result += lastVowel[0];
      continue;
    }
    if (char === " ") {
      result += " ";
      pendingSmallTsu = false;
      continue;
    }

    const pair = kana.slice(index, index + 2);
    const mapped = DIGRAPH_ROMAJI[pair] || KANA_ROMAJI[char] || char;
    if (DIGRAPH_ROMAJI[pair]) index += 1;
    if (pendingSmallTsu) {
      result += doubleConsonant(mapped);
      pendingSmallTsu = false;
    }
    result += mapped;
  }

  return result.replace(/\s+/g, " ").trim();
}

export function hasJapaneseText(value) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value || ""));
}

export function getJapaneseWordMeta(wordEntry) {
  const word = String(wordEntry?.word || "").trim();
  if (!hasJapaneseText(word)) return null;

  const reading = String(
    wordEntry?.japaneseReading ||
      wordEntry?.reading ||
      wordEntry?.pronunciation ||
      wordEntry?.pronounciation ||
      ""
  ).trim();
  const romaji = String(wordEntry?.japaneseRomaji || (reading ? kanaToRomaji(reading) : "")).trim();

  return {
    word,
    reading,
    romaji,
  };
}
