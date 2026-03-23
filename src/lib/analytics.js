const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();
const POSTHOG_KEY = String(import.meta.env.VITE_POSTHOG_KEY || "").trim();
const POSTHOG_HOST = String(import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com").trim();
const GA_SCRIPT_ID = "vocalibry-ga4-script";
const POSTHOG_SCRIPT_ID = "vocalibry-posthog-script";
const POSTHOG_DISTINCT_ID_STORAGE_KEY = "vocalibry_posthog_distinct_id";
const ANALYTICS_CONSENT_STORAGE_KEY = "vocalibry_analytics_consent";

let gaInitialized = false;
let posthogInitialized = false;

function canUseBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isDoNotTrackEnabled() {
  if (!canUseBrowser()) return false;
  const nav = window.navigator || {};
  const dntValue = String(window.doNotTrack || nav.doNotTrack || nav.msDoNotTrack || "").trim();
  return dntValue === "1" || dntValue.toLowerCase() === "yes";
}

function hasMeasurementId() {
  return /^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID);
}

function hasPosthogKey() {
  return Boolean(POSTHOG_KEY);
}

function ensureGtagBootstrap() {
  if (!canUseBrowser()) return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
}

function sanitizeEventName(rawName) {
  const normalized = String(rawName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return "custom_event";
  if (/^[a-z]/.test(normalized)) return normalized;
  return `event_${normalized}`;
}

function sanitizeParams(rawParams) {
  if (!rawParams || typeof rawParams !== "object" || Array.isArray(rawParams)) return {};
  const safe = {};
  Object.entries(rawParams).forEach(([key, value]) => {
    if (!key) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  });
  return safe;
}

export function isAnalyticsEnabled() {
  return isAnalyticsConfigured() && hasAnalyticsConsent() && !isDoNotTrackEnabled();
}

function initGa4() {
  if (!canUseBrowser()) return false;
  if (!hasMeasurementId() || isDoNotTrackEnabled() || !hasAnalyticsConsent()) return false;
  if (gaInitialized) return true;

  ensureGtagBootstrap();

  if (!document.getElementById(GA_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
    anonymize_ip: true,
  });
  gaInitialized = true;
  return true;
}

function ensurePosthogBootstrap() {
  if (!canUseBrowser()) return;
  if (typeof window.posthog === "function" && typeof window.posthog.capture === "function") return;

  const posthogQueue = [];
  const methodNames = [
    "capture",
    "identify",
    "alias",
    "group",
    "people.set",
    "people.set_once",
    "people.unset",
    "people.increment",
    "people.append",
  ];

  const pushCall = (name) => (...args) => {
    posthogQueue.push([name, ...args]);
  };

  const posthogStub = pushCall("__enqueue__");
  methodNames.forEach((name) => {
    posthogStub[name] = pushCall(name);
  });
  posthogStub._q = posthogQueue;
  window.posthog = posthogStub;
}

function initPosthog() {
  if (!canUseBrowser()) return false;
  if (!hasPosthogKey() || isDoNotTrackEnabled() || !hasAnalyticsConsent()) return false;
  if (posthogInitialized) return true;

  ensurePosthogBootstrap();

  if (!document.getElementById(POSTHOG_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = POSTHOG_SCRIPT_ID;
    script.async = true;
    script.src = `${POSTHOG_HOST.replace(/\/$/, "")}/static/array.js`;
    script.onload = () => {
      try {
        if (window.posthog && typeof window.posthog.init === "function") {
          window.posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            capture_pageview: false,
            autocapture: false,
            persistence: "localStorage+cookie",
          });
        }
      } catch {
        // Keep analytics failures non-blocking.
      }
    };
    document.head.appendChild(script);
  }

  try {
    if (window.posthog && typeof window.posthog.init === "function") {
      window.posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: false,
        autocapture: false,
        persistence: "localStorage+cookie",
      });
    }
  } catch {
    // Keep analytics failures non-blocking.
  }

  posthogInitialized = true;
  return true;
}

function getAnalyticsProvider() {
  if (hasMeasurementId()) return "ga4";
  if (hasPosthogKey()) return "posthog";
  return "none";
}

function normalizeConsentValue(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "granted") return "granted";
  if (normalized === "denied") return "denied";
  return "unset";
}

function hasAnalyticsConsent() {
  return getAnalyticsConsentStatus() === "granted";
}

export function isAnalyticsConfigured() {
  return getAnalyticsProvider() !== "none";
}

export function getAnalyticsConsentStatus() {
  if (!canUseBrowser()) return "unset";
  return normalizeConsentValue(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
}

export function setAnalyticsConsentStatus(nextStatus) {
  if (!canUseBrowser()) return;
  const normalized = normalizeConsentValue(nextStatus);
  if (normalized === "unset") {
    localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return;
  }
  localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, normalized);
}

function getOrCreatePosthogDistinctId() {
  if (!canUseBrowser()) return "";

  const fromStorage = String(localStorage.getItem(POSTHOG_DISTINCT_ID_STORAGE_KEY) || "").trim();
  if (fromStorage) return fromStorage;

  let nextId = "";
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    nextId = window.crypto.randomUUID();
  } else {
    nextId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  try {
    localStorage.setItem(POSTHOG_DISTINCT_ID_STORAGE_KEY, nextId);
  } catch {
    // Ignore storage failures; tracking can still proceed for this session.
  }
  return nextId;
}

function sendPosthogCapture(eventName, properties = {}) {
  if (!canUseBrowser()) return false;
  if (!hasPosthogKey()) return false;

  const payload = {
    api_key: POSTHOG_KEY,
    event: String(eventName || "").trim() || "custom_event",
    properties: {
      distinct_id: getOrCreatePosthogDistinctId(),
      $current_url: window.location.href,
      ...properties,
    },
  };

  const body = JSON.stringify(payload);
  const endpoint = `${POSTHOG_HOST.replace(/\/$/, "")}/capture/`;

  try {
    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      keepalive: true,
      mode: "cors",
    }).catch(() => {
      // Keep analytics failures non-blocking.
    });
    return true;
  } catch {
    return false;
  }
}

export function initAnalytics() {
  const provider = getAnalyticsProvider();
  if (provider === "ga4") return initGa4();
  if (provider === "posthog") return initPosthog();
  return false;
}

export function trackEvent(eventName, params = {}) {
  const provider = getAnalyticsProvider();
  if (provider === "ga4") {
    if (!initGa4()) return false;
    window.gtag("event", sanitizeEventName(eventName), sanitizeParams(params));
    return true;
  }
  if (provider === "posthog") {
    if (!initPosthog()) return false;
    const safeName = sanitizeEventName(eventName);
    const safeParams = sanitizeParams(params);
    try {
      if (window.posthog && typeof window.posthog.capture === "function") {
        window.posthog.capture(safeName, safeParams);
      }
      return sendPosthogCapture(safeName, safeParams);
    } catch {
      return sendPosthogCapture(safeName, safeParams);
    }
  }
  return false;
}

export function trackPageView(path, params = {}) {
  const fallbackPath = `${window.location.pathname}${window.location.search || ""}`;
  const pagePath = String(path || fallbackPath).trim() || fallbackPath;
  const safeParams = sanitizeParams(params);
  const provider = getAnalyticsProvider();

  if (provider === "ga4") {
    if (!initGa4()) return false;
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title || "Vocalibry",
      ...safeParams,
    });
    return true;
  }

  if (provider === "posthog") {
    if (!initPosthog()) return false;
    const posthogPayload = {
      path: pagePath,
      page_location: window.location.href,
      page_title: document.title || "Vocalibry",
      ...safeParams,
    };
    try {
      if (window.posthog && typeof window.posthog.capture === "function") {
        window.posthog.capture("$pageview", posthogPayload);
      }
      return sendPosthogCapture("$pageview", posthogPayload);
    } catch {
      return sendPosthogCapture("$pageview", posthogPayload);
    }
  }

  return false;
}
