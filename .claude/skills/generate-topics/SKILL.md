---
name: generate-topics
description: JD 갭 분석 결과에서 부족한 스킬(RED)을 토픽으로 자동 생성합니다.
---

JD 갭 분석 결과에서 부족한 스킬(RED)을 토픽으로 자동 생성합니다.

## 사전 확인

1. `curl -sf http://localhost:3001/ -o /dev/null` 실행하여 dev 서버 확인
2. 실패 시 `curl -sf http://localhost:3000/ -o /dev/null` 시도
3. 둘 다 실패 시: 사용자에게 "Dev 서버가 실행되지 않고 있습니다. `npm run dev`로 시작해주세요." 안내 후 **중단**
4. 응답한 포트를 BASE_URL로 사용

## 실행

`curl -s ${BASE_URL}/api/cron/generate-topics` 호출

## 응답 처리

### 성공 — 토픽 생성됨

```json
{
  "ok": true,
  "created": 3,
  "skills": ["GraphQL", "Docker", "WebSocket"]
}
```

### 성공 — 시장 데이터 없음

```json
{
  "ok": true,
  "message": "No market skills found",
  "created": 0
}
```

→ 이번 주 jd_skill_trends 데이터가 없음. 사용자에게 **"`/crawl-wanted`를 먼저 실행해주세요."** 안내.

### 성공 — 생성 대상 없음 (created: 0, message 없음)

→ RED 스킬이 없거나 이미 이번 주에 토픽이 생성됨. 정상.

### 에러 응답 (HTTP 500)

```json
{ "error": "에러 메시지" }
```

→ Firestore 인덱스 누락: 에러 메시지에 인덱스 생성 URL이 포함되어 있으면 해당 링크 안내
→ Firebase 인증 문제: `.env.local`의 `FIREBASE_ADMIN_*` 값 확인 안내

## 결과 출력

실행 결과를 아래 포맷으로 요약하세요:

### 갭 토픽 생성 결과

| 항목             | 값                  |
| ---------------- | ------------------- |
| 생성된 토픽      | N건                 |
| 대상 스킬        | skill1, skill2, ... |
| 스킵 (이미 존재) | 해당 시 표시        |

[시장 데이터가 없으면 `/crawl-wanted` 실행 안내]
[에러 시 원인과 해결 방법 안내]

## 동작 방식

- jd_skill_trends에서 이번 주 시장 요구 스킬 상위 20개 조회
- learning_skills에서 내 역량(confidence_level) 비교
- confidence < 40% (RED) 스킬만 토픽 생성
- 이번 주 이미 생성된 갭 토픽은 스킵
- 미션 타입은 concept/discussion/code 중 랜덤 배정
