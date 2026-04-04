export interface RssSource {
  id: string;
  name: string;
  url: string;
  language: "ko" | "en";
}

export const RSS_SOURCES: RssSource[] = [
  {
    id: "geeknews",
    name: "긱뉴스",
    url: "https://news.hada.io/rss",
    language: "ko",
  },
  {
    id: "kofearticle",
    name: "Korean FE Article",
    url: "https://kofearticle.substack.com/feed",
    language: "ko",
  },
  {
    id: "js-weekly",
    name: "JavaScript Weekly",
    url: "https://javascriptweekly.com/rss/",
    language: "en",
  },
  {
    id: "css-weekly",
    name: "CSS Weekly",
    url: "https://css-weekly.com/feed.xml",
    language: "en",
  },
  {
    id: "smashing",
    name: "Smashing Magazine",
    url: "https://www.smashingmagazine.com/feed",
    language: "en",
  },
  {
    id: "devto-frontend",
    name: "dev.to Frontend",
    url: "https://dev.to/feed/tag/frontend",
    language: "en",
  },
];
