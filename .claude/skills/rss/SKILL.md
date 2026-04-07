---
name: rss
description: RSS 아티클을 수집합니다. 6개 한국어 소스에서 최신 아티클을 가져와 Firestore에 저장합니다.
---

RSS 아티클을 수집합니다. 6개 한국어 소스에서 최신 아티클을 가져옵니다.

## 사전 확인

1. `curl -sf http://localhost:3001/ -o /dev/null` 실행하여 dev 서버 확인
2. 실패 시 `curl -sf http://localhost:3000/ -o /dev/null` 시도
3. 둘 다 실패 시: 사용자에게 "Dev 서버가 실행되지 않고 있습니다. `npm run dev`로 시작해주세요." 안내 후 **중단**
4. 응답한 포트를 BASE_URL로 사용

## 실행

`curl -s ${BASE_URL}/api/cron/rss` 호출

## 응답 처리

### 성공 응답

```json
{
  "ok": true,
  "totalAdded": 3,
  "results": [
    { "source": "긱뉴스", "added": 2, "skipped": 10 },
    { "source": "카카오 기술블로그", "added": 1, "skipped": 5 },
    { "source": "토스 기술블로그", "added": 0, "skipped": 8 }
  ]
}
```

### 소스별 이상 감지

- `added: 0, skipped: 0`인 소스가 있으면 → 해당 소스에 접속하지 못했을 가능성이 높음. "**[소스명]**에서 아티클을 가져오지 못했습니다. 피드 URL 변경 또는 접속 차단 가능성이 있습니다." 안내
- 모든 소스가 `added: 0`이고 `skipped > 0`이면 → 정상 (새 아티클이 없는 것)
- `totalAdded: 0`이고 모든 소스가 `0/0`이면 → 네트워크 문제 가능성. 인터넷 연결 확인 안내

### 에러 응답 (HTTP 500)

```json
{ "error": "에러 메시지" }
```

→ Firebase 인증 문제: `.env.local`의 `FIREBASE_ADMIN_*` 값 확인 안내
→ RSS 파싱 에러: 특정 소스의 피드 형식 변경 가능성

## 결과 출력

실행 결과를 아래 포맷으로 요약하세요:

### RSS 수집 결과

| 소스                    | 추가  | 스킵  |
| ----------------------- | ----- | ----- |
| 긱뉴스                  | N     | N     |
| Korean FE Article       | N     | N     |
| 카카오 기술블로그       | N     | N     |
| 토스 기술블로그         | N     | N     |
| 우아한형제들 기술블로그 | N     | N     |
| 요즘IT                  | N     | N     |
| **합계**                | **N** | **N** |

[에러 또는 특이사항이 있으면 원인과 해결 방법 안내]

## 수집 소스

- 긱뉴스 (news.hada.io)
- Korean FE Article (kofearticle.substack.com)
- 카카오 기술블로그 (tech.kakao.com)
- 토스 기술블로그 (toss.tech)
- 우아한형제들 기술블로그 (techblog.woowahan.com)
- 요즘IT (yozm.wishket.com)
