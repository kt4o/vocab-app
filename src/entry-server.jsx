import { renderToString } from "react-dom/server";
import { LandingPage } from "./pages/LandingPage.jsx";
import { TermsPage } from "./pages/TermsPage.jsx";
import { PrivacyPage } from "./pages/PrivacyPage.jsx";
import { DisclaimerPage } from "./pages/DisclaimerPage.jsx";
import { ContactPage } from "./pages/ContactPage.jsx";
import { PricingPage } from "./pages/PricingPage.jsx";
import { FeaturesPage } from "./pages/FeaturesPage.jsx";
import { VocabularyGuidePage } from "./pages/VocabularyGuidePage.jsx";
import { MemorizeVocabularyPage } from "./pages/MemorizeVocabularyPage.jsx";
import { VocabularyInContextPage } from "./pages/VocabularyInContextPage.jsx";
import { GuidesPage } from "./pages/GuidesPage.jsx";
import { SpacedRepetitionVocabularyPage } from "./pages/SpacedRepetitionVocabularyPage.jsx";
import { WordsPerDayPage } from "./pages/WordsPerDayPage.jsx";
import { ForgetLookedUpWordsPage } from "./pages/ForgetLookedUpWordsPage.jsx";
import { RememberVocabularyFromBooksPage } from "./pages/RememberVocabularyFromBooksPage.jsx";
import { ROUTE_SEO, ARTICLE_ROUTE_KEYS, getRoute } from "./config/siteSeo.js";
import { getBreadcrumbStructuredData } from "./config/breadcrumbs.js";

const DEFAULT_SITE_URL = "https://www.vocalibry.com";
const DEFAULT_OG_IMAGE_PATH = "/og-image.png";

function getPublicPage(route) {
  switch (route) {
    case "pricing":
      return <PricingPage />;
    case "features":
      return <FeaturesPage />;
    case "vocabulary-guide":
      return <VocabularyGuidePage />;
    case "memorize-vocabulary":
      return <MemorizeVocabularyPage />;
    case "vocabulary-in-context":
      return <VocabularyInContextPage />;
    case "guides":
      return <GuidesPage />;
    case "spaced-repetition-vocabulary":
      return <SpacedRepetitionVocabularyPage />;
    case "words-per-day":
      return <WordsPerDayPage />;
    case "forget-looked-up-words":
      return <ForgetLookedUpWordsPage />;
    case "remember-vocabulary-from-books":
      return <RememberVocabularyFromBooksPage />;
    case "contact":
      return <ContactPage />;
    case "terms":
      return <TermsPage />;
    case "privacy":
      return <PrivacyPage />;
    case "disclaimer":
      return <DisclaimerPage />;
    case "landing":
      return <LandingPage />;
    default:
      return <LandingPage />;
  }
}

export function renderPage(pathname, siteUrl = DEFAULT_SITE_URL) {
  const route = getRoute(pathname);
  const seo = ROUTE_SEO[route] || ROUTE_SEO.landing;
  const canonicalUrl = `${siteUrl}${pathname}`;
  const ogImageUrl = `${siteUrl}${DEFAULT_OG_IMAGE_PATH}`;
  const breadcrumbJsonLd = getBreadcrumbStructuredData(route, siteUrl);

  return {
    route,
    seo,
    html: renderToString(getPublicPage(route)),
    canonicalUrl,
    ogImageUrl,
    ogType: ARTICLE_ROUTE_KEYS.has(route) ? "article" : "website",
    breadcrumbJsonLd,
  };
}

