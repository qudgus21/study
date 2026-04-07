export interface RssSource {
  id: string;
  name: string;
  url: string;
}

export const RSS_SOURCES: RssSource[] = [
  {
    id: "geeknews",
    name: "긱뉴스",
    url: "https://news.hada.io/rss/news",
  },
  {
    id: "kofearticle",
    name: "Korean FE Article",
    url: "https://kofearticle.substack.com/feed",
  },
  {
    id: "kakao-tech",
    name: "카카오 기술블로그",
    url: "https://tech.kakao.com/blog/feed",
  },
  {
    id: "toss-tech",
    name: "토스 기술블로그",
    url: "https://toss.tech/rss.xml",
  },
  {
    id: "woowahan-tech",
    name: "우아한형제들 기술블로그",
    url: "https://techblog.woowahan.com/feed/",
  },
  {
    id: "yozm-it",
    name: "요즘IT",
    url: "https://yozm.wishket.com/magazine/feed/",
  },
];
