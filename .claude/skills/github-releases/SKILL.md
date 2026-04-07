---
description: GitHub 주요 프론트엔드 라이브러리의 최신 릴리스를 수집합니다.
---

GitHub 주요 라이브러리의 최신 릴리스를 수집합니다.

## 사전 확인

1. `curl -sf http://localhost:3001/ -o /dev/null` 실행하여 dev 서버 확인
2. 실패 시 `curl -sf http://localhost:3000/ -o /dev/null` 시도
3. 둘 다 실패 시: 사용자에게 "Dev 서버가 실행되지 않고 있습니다. `npm run dev`로 시작해주세요." 안내 후 **중단**
4. 응답한 포트를 BASE_URL로 사용

## 실행

`curl -s ${BASE_URL}/api/cron/github` 호출

- GitHub API rate limit 주의 (인증 없이 60req/hr)

## 응답 처리

### 성공 응답

```json
{
  "ok": true,
  "added": 2,
  "results": [
    { "repo": "facebook/react", "status": "added" },
    { "repo": "vercel/next.js", "status": "already_exists" },
    { "repo": "vitejs/vite", "status": "fetch_failed" }
  ]
}
```

`status` 값:

- `added`: 새 릴리스 추가됨
- `already_exists`: 이미 수집된 릴리스 (정상)
- `fetch_failed`: GitHub API 호출 실패 → rate limit 또는 네트워크 문제

### 에러 응답 (HTTP 500)

```json
{ "error": "에러 메시지" }
```

## 결과 출력

실행 결과를 아래 포맷으로 요약하세요:

### GitHub 릴리스 수집 결과

| Repo           | 상태                                  |
| -------------- | ------------------------------------- |
| facebook/react | added / already_exists / fetch_failed |
| vercel/next.js | ...                                   |
| ...            | ...                                   |

**새로 추가: N건**

`fetch_failed`가 있는 경우:

- 1-2개 repo만 실패: 해당 repo의 릴리스 페이지가 변경되었거나 일시적 오류일 수 있음. 잠시 후 재시도 안내
- 다수 repo 실패: GitHub API rate limit(인증 없이 60req/hr) 가능성 높음. "1시간 후 재시도하거나, `.env.local`에 `GITHUB_TOKEN`을 설정하면 5,000req/hr로 늘릴 수 있습니다." 안내
- 특정 repo가 반복적으로 실패: repo 이름 변경(예: `framer/motion` → 다른 이름) 가능성. GitHub에서 직접 확인 필요

## 감시 대상 (9개 repo)

- facebook/react
- vercel/next.js
- microsoft/TypeScript
- vitejs/vite
- tailwindlabs/tailwindcss
- shadcn-ui/ui
- pmndrs/zustand
- framer/motion
- nodejs/node
