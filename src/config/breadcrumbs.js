const GUIDE_BREADCRUMB_LABELS = {
  guides: "Guides",
  "vocabulary-guide": "How to Expand Your Vocabulary",
  "memorize-vocabulary": "How to Memorize Vocabulary",
  "vocabulary-in-context": "How to Learn Vocabulary in Context",
  "spaced-repetition-vocabulary": "Spaced Repetition for Vocabulary",
  "words-per-day": "How Many Words Should You Learn Per Day?",
  "forget-looked-up-words": "Why You Forget Words You Look Up While Reading",
  "remember-vocabulary-from-books": "How to Remember Vocabulary From Books",
};

export function getBreadcrumbItems(route, siteUrl = "") {
  const guidesLabel = GUIDE_BREADCRUMB_LABELS.guides;
  const homeHref = siteUrl ? `${siteUrl}/` : "/";
  const guidesHref = siteUrl ? `${siteUrl}/guides` : "/guides";

  if (route === "guides") {
    return [
      { name: "Home", href: homeHref },
      { name: guidesLabel },
    ];
  }

  const currentLabel = GUIDE_BREADCRUMB_LABELS[route];
  if (!currentLabel) return [];

  return [
    { name: "Home", href: homeHref },
    { name: guidesLabel, href: guidesHref },
    { name: currentLabel },
  ];
}

export function getBreadcrumbStructuredData(route, siteUrl) {
  const items = getBreadcrumbItems(route, siteUrl);
  if (!items.length) return null;

  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => {
      const nextItem = {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
      };
      if (item.href) {
        nextItem.item = item.href;
      }
      return nextItem;
    }),
  };
}

