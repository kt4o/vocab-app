import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { hasJapaneseText } from "../lib/japaneseText";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const AUDIO_CACHE = new Map();

function getSpeechLanguage(text, language) {
  const explicitLanguage = String(language || "").trim();
  if (explicitLanguage) return explicitLanguage;
  return hasJapaneseText(text) ? "ja-JP" : "en-US";
}

function pickVoice(language) {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  const normalizedLanguage = String(language || "").toLowerCase();
  return (
    voices.find(
      (voice) =>
        voice.lang.toLowerCase() === normalizedLanguage &&
        /premium|enhanced|natural|neural|siri|google/i.test(voice.name)
    ) ||
    voices.find((voice) => voice.lang.toLowerCase() === normalizedLanguage) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith(normalizedLanguage.split("-")[0])) ||
    null
  );
}

function getAudioEndpointCandidates(path) {
  const endpointCandidates = [`${API_BASE_URL}${path}`];
  const onLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (!API_BASE_URL && onLocalhost) {
    endpointCandidates.push(`http://localhost:4000${path}`);
  }
  return endpointCandidates;
}

async function fetchGeneratedAudioUrl(text, language) {
  const cacheKey = `${language}\n${text}`;
  if (AUDIO_CACHE.has(cacheKey)) return AUDIO_CACHE.get(cacheKey);

  for (const endpoint of getAudioEndpointCandidates("/api/audio/speech")) {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    }).catch(() => null);

    if (!response?.ok) continue;

    const blob = await response.blob();
    if (!blob.size) continue;

    const audioUrl = URL.createObjectURL(blob);
    AUDIO_CACHE.set(cacheKey, audioUrl);
    return audioUrl;
  }

  return "";
}

export function AudioButton({
  text,
  language = "",
  label = "Play audio",
  className = "",
  size = "sm",
}) {
  const [isSupported, setIsSupported] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const utteranceRef = useRef(null);
  const audioRef = useRef(null);
  const playRequestRef = useRef(0);
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  const speechLanguage = getSpeechLanguage(cleanText, language);

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        (typeof window.Audio === "function" || "speechSynthesis" in window)
    );
    return () => {
      audioRef.current?.pause();
      if (utteranceRef.current && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!cleanText || !isSupported) return null;

  function stopAudio() {
    playRequestRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }

  function playBrowserSpeech() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = speechLanguage;
    utterance.rate = speechLanguage.toLowerCase().startsWith("ja") ? 0.86 : 0.92;
    utterance.voice = pickVoice(speechLanguage);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  async function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (typeof window === "undefined") return;

    if (isSpeaking || isLoading) {
      stopAudio();
      setIsLoading(false);
      return;
    }

    stopAudio();
    setIsLoading(true);
    const requestId = playRequestRef.current;

    try {
      const audioUrl = await fetchGeneratedAudioUrl(cleanText, speechLanguage);
      if (requestId !== playRequestRef.current) return;
      if (!audioUrl) {
        console.warn("Generated audio unavailable; using browser voice fallback.");
        playBrowserSpeech();
        return;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => {
        setIsSpeaking(false);
      };
      setIsSpeaking(true);
      await audio.play();
    } catch (error) {
      if (requestId === playRequestRef.current) {
        console.warn("Generated audio failed; using browser voice fallback.", error);
        playBrowserSpeech();
      }
    } finally {
      setIsLoading(false);
    }
  }

  const Icon = isSpeaking || isLoading ? Square : Volume2;

  return (
    <button
      type="button"
      className={`audioButton audioButton-${size} ${isSpeaking || isLoading ? "isSpeaking" : ""} ${className}`.trim()}
      aria-label={isSpeaking || isLoading ? "Stop audio" : label}
      title={isSpeaking || isLoading ? "Stop audio" : label}
      onClick={handleClick}
    >
      <Icon aria-hidden="true" size={size === "lg" ? 20 : 16} strokeWidth={2.2} />
    </button>
  );
}
