const API_BASE_URL = String(process.env.SMOKE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

async function requestJson(pathname) {
  const response = await fetch(`${API_BASE_URL}${pathname}`);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  console.log(`[smoke] API base: ${API_BASE_URL}`);

  const health = await requestJson("/api/health");
  assert(health.response.ok, "Health endpoint is not reachable.");
  assert(health.payload?.ok === true, "Health payload is missing ok=true.");
  console.log("[smoke] /api/health ok");

  const words = await requestJson("/api/words?difficulty=a1&q=ab");
  assert(words.response.ok, "Words endpoint request failed.");
  assert(Array.isArray(words.payload?.words), "Words payload is missing words array.");
  assert(Number.isFinite(Number(words.payload?.count)), "Words payload is missing numeric count.");
  console.log("[smoke] /api/words ok");

  console.log("[smoke] passed");
}

run().catch((error) => {
  console.error("[smoke] failed:", error.message || error);
  process.exit(1);
});
