import { XMLParser } from "fast-xml-parser";
import type { RssSource } from "./sources";

export interface FetchedArticle {
  title: string;
  url: string;
  source: string;
  summary: string;
  published_at: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
});

function extractText(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "#text" in val) {
    return String((val as Record<string, unknown>)["#text"]);
  }
  return "";
}

function parseDate(val: unknown): string {
  if (!val) return new Date().toISOString();
  try {
    return new Date(extractText(val)).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 300);
}

function parseItems(feed: Record<string, unknown>, sourceName: string): FetchedArticle[] {
  // RSS 2.0
  const channel = (feed as Record<string, unknown>)?.rss as Record<string, unknown> | undefined;
  if (channel?.channel) {
    const ch = channel.channel as Record<string, unknown>;
    const items = Array.isArray(ch.item) ? ch.item : ch.item ? [ch.item] : [];
    return (items as Record<string, unknown>[]).slice(0, 20).map((item) => ({
      title: extractText(item.title) || "제목 없음",
      url: extractText(item.link) || extractText(item.guid) || "",
      source: sourceName,
      summary: stripHtml(extractText(item.description) || extractText(item.summary) || ""),
      published_at: parseDate(item.pubDate || item.published),
    }));
  }

  // Atom
  const atomFeed = (feed as Record<string, unknown>)?.feed as Record<string, unknown> | undefined;
  if (atomFeed) {
    const entries = Array.isArray(atomFeed.entry)
      ? atomFeed.entry
      : atomFeed.entry
        ? [atomFeed.entry]
        : [];
    return (entries as Record<string, unknown>[]).slice(0, 20).map((entry) => {
      const linkVal = entry.link;
      let url = "";
      if (typeof linkVal === "string") url = linkVal;
      else if (Array.isArray(linkVal)) {
        const altLink = (linkVal as Record<string, unknown>[]).find(
          (l) => l["@_rel"] === "alternate" || !l["@_rel"],
        );
        url = altLink ? String(altLink["@_href"] ?? "") : "";
      } else if (typeof linkVal === "object" && linkVal !== null) {
        url = String((linkVal as Record<string, unknown>)["@_href"] ?? "");
      }

      return {
        title: extractText(entry.title) || "제목 없음",
        url,
        source: sourceName,
        summary: stripHtml(extractText(entry.summary) || extractText(entry.content) || ""),
        published_at: parseDate(entry.published || entry.updated),
      };
    });
  }

  return [];
}

export async function fetchRssSource(source: RssSource): Promise<FetchedArticle[]> {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (study-tool RSS reader)" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[RSS] ${source.name}: HTTP ${res.status} ${res.statusText}`);
      return [];
    }

    const xml = await res.text();
    if (!xml || xml.length < 100) {
      console.warn(`[RSS] ${source.name}: Empty or too short response (${xml.length} bytes)`);
      return [];
    }

    const feed = parser.parse(xml) as Record<string, unknown>;
    const items = parseItems(feed, source.name);
    if (items.length === 0) {
      console.warn(`[RSS] ${source.name}: Parsed 0 items. XML starts with: ${xml.slice(0, 200)}`);
    }
    return items;
  } catch (err) {
    console.warn(`[RSS] ${source.name}: Fetch error:`, err instanceof Error ? err.message : err);
    return [];
  }
}
