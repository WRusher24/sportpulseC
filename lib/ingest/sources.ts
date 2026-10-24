export type SourceConfig = {
  key: "sport5" | "one" | "sport1" | "ynet" | "walla";
  nameHe: string;
  /** RSS/Atom endpoints tried in order. Override with FEED_URL_<KEY> when a portal moves its feed. */
  feeds: string[];
  /** HTML section page used as a fallback when no feed responds. */
  listing: string;
  /** Matches article URLs on the listing page. */
  articleUrl: RegExp;
  /** Extra CSS hints (tried before the generic text-density heuristic). */
  bodySelectors: string[];
  authorSelectors: string[];
};

const env = (name: string) => process.env[name]?.trim() || undefined;

export function getSources(): SourceConfig[] {
  const withEnv = (key: string, defaults: string[]) => (env(`FEED_URL_${key.toUpperCase()}`) ? [env(`FEED_URL_${key.toUpperCase()}`) as string] : defaults);
  return [
    {
      key: "sport5",
      nameHe: "ספורט 5",
      feeds: withEnv("sport5", ["https://rss.sport5.co.il/rss.aspx?FolderId=190", "https://www.sport5.co.il/rss.aspx?FolderId=190"]),
      listing: "https://www.sport5.co.il/",
      articleUrl: /sport5\.co\.il\/(?:.*docid=\d+|.*\/article\/|articles?\.aspx)/i,
      bodySelectors: ["[itemprop=articleBody]", ".article-main", ".article-content", "article"],
      authorSelectors: ["[itemprop=author]", ".article-author", ".author"]
    },
    {
      key: "one",
      nameHe: "ONE",
      feeds: withEnv("one", ["https://www.one.co.il/cat/coop/xml/rss/newsfeed.xml"]),
      listing: "https://www.one.co.il/",
      articleUrl: /one\.co\.il\/(?:Article|article)\//,
      bodySelectors: ["[itemprop=articleBody]", ".article-body", "#articleBody", "article"],
      authorSelectors: ["[itemprop=author]", ".article-writer", ".author"]
    },
    {
      key: "sport1",
      nameHe: "ספורט 1",
      feeds: withEnv("sport1", ["https://sport1.maariv.co.il/rss/"]),
      listing: "https://sport1.maariv.co.il/",
      articleUrl: /sport1\.maariv\.co\.il\/.*\d{5,}/i,
      bodySelectors: ["[itemprop=articleBody]", ".article-body", ".article-content", "article"],
      authorSelectors: ["[itemprop=author]", ".article-author", ".author"]
    },
    {
      key: "ynet",
      nameHe: "ידיעות ספורט",
      feeds: withEnv("ynet", ["https://www.ynet.co.il/Integration/StoryRss3.xml"]),
      listing: "https://www.ynet.co.il/sport",
      articleUrl: /ynet\.co\.il\/sport\/article\/\w+/i,
      bodySelectors: ["[data-text=true]", ".public-DraftEditor-content", "[itemprop=articleBody]", "article"],
      authorSelectors: [".authors", "[itemprop=author]", ".author"]
    },
    {
      key: "walla",
      nameHe: "וואלה! ספורט",
      feeds: withEnv("walla", ["https://rss.walla.co.il/feed/3"]),
      listing: "https://sports.walla.co.il/",
      articleUrl: /walla\.co\.il\/item\/\d+/i,
      bodySelectors: [".article-content", "[itemprop=articleBody]", "section.article", "article"],
      authorSelectors: [".author", "[itemprop=author]", ".writer"]
    }
  ];
}
