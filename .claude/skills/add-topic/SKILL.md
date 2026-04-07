---
description: 커스텀 학습 토픽을 수동으로 추가합니다. 질문, 미션 타입, 카테고리 등을 지정합니다.
---

커스텀 학습 토픽을 수동으로 추가합니다.

## 1. 사용자 입력 확인

사용자에게 다음 정보를 확인합니다. 누락된 필수 정보가 있으면 반드시 물어보세요:

- **제목** (필수): 토픽 제목
- **설명** (필수): 학습 목표 설명
- **미션 타입** (필수): `concept` / `discussion` / `code` 중 하나
  - 이 3가지가 아닌 값이 입력되면 올바른 값을 다시 요청
- **카테고리** (선택): React, TypeScript, CSS, Performance 등 (기본값: "기타")
- **난이도** (선택): beginner / intermediate / advanced (기본값: intermediate)
- **코드 스니펫** (선택): code 타입인 경우 리뷰 대상 코드

## 2. 확인 단계

API 호출 전에 사용자에게 아래 형태로 요약을 보여주고 확인을 받으세요:

```
토픽을 추가합니다:
- 제목: [입력값]
- 설명: [입력값]
- 미션 타입: [입력값]
- 카테고리: [입력값]
- 난이도: [입력값]
진행할까요?
```

## 3. 서버 확인 및 API 호출

1. `curl -sf http://localhost:3001/ -o /dev/null` 실행하여 dev 서버 확인
2. 실패 시 `curl -sf http://localhost:3000/ -o /dev/null` 시도
3. 둘 다 실패 시: "Dev 서버가 실행되지 않고 있습니다. `npm run dev`로 시작해주세요." 안내 후 **중단**

4. `POST ${BASE_URL}/api/topics` 호출:
   ```json
   {
     "title": "...",
     "description": "...",
     "mission_type": "concept|discussion|code",
     "category_name": "...",
     "difficulty": "intermediate",
     "source_type": "manual",
     "code_snippet": null
   }
   ```

## 4. 응답 처리

### 성공 응답

```json
{ "id": "firestore-document-id", "ok": true }
```

→ 토픽 ID와 입력 정보를 요약하여 표시

### 에러 응답 (HTTP 400/500)

```json
{ "error": "에러 메시지" }
```

→ 400: 입력값 문제 — 어떤 필드가 잘못되었는지 안내
→ 500: 서버 에러 — Firebase 인증 확인 안내

## 참고

- source_type은 "manual"로 설정 (수동 추가 표시)
- 추가된 토픽은 `/api/missions` POST로 미션에 배정 가능
