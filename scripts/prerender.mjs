import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PRERENDER_ROUTES } from "../src/config/siteSeo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const ssrDir = path.join(projectRoot, "dist-ssr");
const siteUrl = String(process.env.VITE_SITE_URL || "https://www.vocalibry.com").trim().replace(/\/$/, "");

function buildHeadMarkup({ seo, canonicalUrl, ogImageUrl, ogType, breadcrumbJsonLd }) {
  const structuredData = breadcrumbJsonLd
    ? `\n    <script type="application/ld+json" id="seo-jsonld-route">${JSON.stringify({
        "@context": "https://schema.org",
        ...breadcrumbJsonLd,
      })}</script>`
    : "";

  return `
    <title>${seo.title}</title>
    <meta name="description" content="${seo.description}" />
    <meta name="robots" content="${seo.indexable ? "index,follow" : "noindex,nofollow"}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="Vocalibry" />
    <meta property="og:title" content="${seo.title}" />
    <meta property="og:description" content="${seo.description}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${ogImageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${seo.title}" />
    <meta name="twitter:description" content="${seo.description}" />
    <meta name="twitter:image" content="${ogImageUrl}" />${structuredData}`;
}

function injectPrerenderedMarkup(template, pageData) {
  const withTitleRemoved = template.replace(/<title>[\s\S]*?<\/title>/i, "");
  const withMeta = withTitleRemoved.replace("</head>", `${buildHeadMarkup(pageData)}\n  </head>`);
  return withMeta.replace('<div id="root"></div>', `<div id="root">${pageData.html}</div>`);
}

async function main() {
  const template = await readFile(path.join(distDir, "index.html"), "utf8");
  const serverEntryUrl = pathToFileURL(path.join(ssrDir, "entry-server.js")).href;
  const { renderPage } = await import(serverEntryUrl);

  for (const routePath of PRERENDER_ROUTES) {
    const pageData = renderPage(routePath, siteUrl);
    const outputHtml = injectPrerenderedMarkup(template, pageData);
    const targetDir = routePath === "/" ? distDir : path.join(distDir, routePath.replace(/^\//, ""));
    const targetFile = path.join(targetDir, "index.html");

    await mkdir(targetDir, { recursive: true });
    await writeFile(targetFile, outputHtml, "utf8");
  }

  await rm(ssrDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error("Prerender failed:", error);
  process.exit(1);
});
