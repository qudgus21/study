---
description: 원티드 프론트엔드 채용공고를 크롤링하고 스킬 트렌드를 집계합니다.
---

원티드 프론트엔드 채용공고를 크롤링하고 스킬 트렌드를 집계합니다.

## 사전 확인

1. `curl -sf http://localhost:3001/ -o /dev/null` 실행하여 dev 서버 확인
2. 실패 시 `curl -sf http://localhost:3000/ -o /dev/null` 시도
3. 둘 다 실패 시: 사용자에게 "Dev 서버가 실행되지 않고 있습니다. `npm run dev`로 시작해주세요." 안내 후 **중단**
4. 응답한 포트를 BASE_URL로 사용

## 실행

`curl -s ${BASE_URL}/api/cron/wanted` 호출

- 최대 20개 JD 크롤링, 500ms 딜레이 적용
- 응답 대기 시간이 길 수 있음 (30초+) — 정상

## 응답 처리

### 성공 응답 (ok: true)

```json
{ "ok": true, "added": 5, "skipped": 12, "skillsTracked": 8 }
```

### 데이터 없음 (ok: true, added: 0)

```json
{ "ok": true, "message": "No jobs fetched", "added": 0 }
```

→ Wanted API가 데이터를 반환하지 않은 경우. IP 차단 또는 API 변경 가능성. 잠시 후 재시도 안내.

### 에러 응답 (HTTP 500)

```json
{ "error": "에러 메시지" }
```

→ Firebase 인증 문제: `.env.local`의 `FIREBASE_ADMIN_*` 값 확인 안내
→ 네트워크 에러: Wanted API 접속 불가. VPN 또는 네트워크 확인 안내

## 결과 출력

실행 결과를 아래 포맷으로 요약하세요:

### 원티드 크롤링 결과

| 항목        | 값  |
| ----------- | --- |
| 추가된 JD   | N건 |
| 스킵 (중복) | N건 |
| 추적 스킬   | N개 |

[에러 또는 특이사항이 있으면 원인과 해결 방법 안내]

## 수집 대상

- Wanted v4 API (`tag_type_ids=669` = 프론트엔드)
- 각 JD에서 required_skills, preferred_skills 추출
- jd_skill_trends 컬렉션에 주간 스킬 카운트 집계
