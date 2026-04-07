---
description: 데일리 하우스키핑을 실행합니다. 주간 문서 생성 및 미완료 미션 이월을 처리합니다.
---

데일리 하우스키핑을 실행합니다. 주간 문서 생성 및 미완료 미션 이월을 처리합니다.

## 사전 확인

1. `curl -sf http://localhost:3001/ -o /dev/null` 실행하여 dev 서버 확인
2. 실패 시 `curl -sf http://localhost:3000/ -o /dev/null` 시도
3. 둘 다 실패 시: 사용자에게 "Dev 서버가 실행되지 않고 있습니다. `npm run dev`로 시작해주세요." 안내 후 **중단**
4. 응답한 포트를 BASE_URL로 사용

## 실행

`curl -s ${BASE_URL}/api/cron/daily` 호출

## 응답 처리

### 성공 응답

```json
{
  "ok": true,
  "results": ["Created new week: 2026-04-05", "Carried over 3 missions from 2026-03-29"]
}
```

`results` 배열에는 수행된 작업 목록이 문자열로 들어옴:

- `"Created new week: YYYY-MM-DD"` — 새 주간 문서 생성됨
- `"Carried over N missions from YYYY-MM-DD"` — N개 미완료 미션 이월됨
- 배열이 비어있으면 → 이미 현재 주간 문서가 존재하고, 이월할 미션 없음 (정상)

### 에러 응답 (HTTP 500)

```json
{ "error": "에러 메시지" }
```

→ Firebase 인증 문제: `.env.local`의 `FIREBASE_ADMIN_*` 값 확인 안내

## 결과 출력

실행 결과를 아래 포맷으로 요약하세요:

### 데일리 하우스키핑 결과

| 항목      | 결과                            |
| --------- | ------------------------------- |
| 주간 문서 | 생성됨 (YYYY-MM-DD) / 이미 존재 |
| 미션 이월 | N건 이월 / 이월 대상 없음       |

[특이���항이 있으면 안내]

## 동작 방식

- 현재 주차(week_start)에 해당하는 weeks 문서가 없으면 자동 생성
- 새 주 시작 시 이전 주의 미완료 미션을 이월:
  - settings/global의 carry_over_limit(기본 5개)까지만 이월
  - 이월된 미션은 is_carried_over: true로 표시
  - status를 "pending"으로 리셋
