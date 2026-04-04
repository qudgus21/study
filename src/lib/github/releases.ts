export interface GitHubRelease {
  repo: string;
  tag_name: string;
  release_name: string;
  body_summary: string;
  published_at: string;
  url: string;
}

export const WATCHED_REPOS = [
  "facebook/react",
  "vercel/next.js",
  "microsoft/TypeScript",
  "vitejs/vite",
  "tailwindlabs/tailwindcss",
  "shadcn-ui/ui",
  "pmndrs/zustand",
  "framer/motion",
  "nodejs/node",
] as const;

export async function fetchLatestRelease(repo: string): Promise<GitHubRelease | null> {
  try {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "User-Agent": "study-tool/1.0",
    };

    // GITHUB_TOKEN이 있으면 rate limit 향상 (선택)
    if (process.env.GITHUB_TOKEN) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`GitHub release fetch failed for ${repo}: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as {
      tag_name: string;
      name: string;
      body: string;
      published_at: string;
      html_url: string;
    };

    return {
      repo,
      tag_name: data.tag_name ?? "",
      release_name: data.name ?? data.tag_name ?? "",
      body_summary: (data.body ?? "").slice(0, 500),
      published_at: data.published_at ?? new Date().toISOString(),
      url: data.html_url ?? "",
    };
  } catch (err) {
    console.warn(`GitHub release error for ${repo}:`, err);
    return null;
  }
}
