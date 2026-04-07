---
description: 변경사항을 커밋하고 푸시까지 한번에 수행합니다.
---

변경사항을 커밋하고 푸시까지 한번에 수행합니다.

## 1. 상태 확인

아래 명령어를 실행하여 현재 상태를 파악합니다:

```bash
git status
git diff --stat
git diff --staged --stat
git log --oneline -5
```

- 변경사항이 없으면 "커밋할 변경사항이 없습니다." 안내 후 **중단**

## 2. 민감 파일 검사

아래 패턴에 해당하는 파일이 변경 목록에 있으면 **커밋에서 제외**하고 사용자에게 경고:

- `.env*` (`.env`, `.env.local`, `.env.production` 등)
- `*credential*`, `*secret*`
- `serviceAccount*.json`, `firebase-admin*.json`
- `*.pem`, `*.key`

## 3. 브랜치 확인

- 현재 브랜치가 `main` 또는 `master`이면 경고: "현재 main 브랜치에 있습니다. 직접 커밋/푸시하시겠습니까?"
- 사용자 확인 후 진행

## 4. 린트/타입 체크 (선택)

변경된 파일이 `.ts`, `.tsx` 파일을 포함하면:

```bash
npx tsc --noEmit 2>&1 | head -20
```

- 에러가 있으면 사용자에게 알리고 진행 여부 확인
- 기존에 있던 에러와 새로 발생한 에러를 구분하여 안내

## 5. 변경사항 요약 및 확인

사용자에게 아래 정보를 보여주고 확인을 받습니다:

```
변경사항 요약:
- 수정: N개 파일
- 추가: N개 파일
- 삭제: N개 파일

커밋 메시지: [생성한 메시지]

진행할까요?
```

## 6. 커밋 메시지 작성 규칙

- conventional commit 스타일: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` 등
- `git log --oneline -5`에서 확인한 기존 스타일(한글/영어)을 따름
- 1-2문장으로 간결하게, "왜" 변경했는지에 집중
- Co-Authored-By 태그 포함

## 7. 커밋 및 푸시

```bash
# 관련 파일만 스테이징 (git add -A 사용 금지)
git add [파일1] [파일2] ...

# 커밋
git commit -m "$(cat <<'EOF'
커밋 메시지

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"

# 푸시
git push
# 리모트 브랜치가 없으면: git push -u origin <branch>
```

## 8. 에러 처리

### push 실패 — 리모트와 diverge

→ `git pull --rebase` 안내. **절대 force push 하지 말 것.**

### push 실패 — 인증 문제

→ Git credential 또는 SSH key 확인 안내

### pre-commit hook 실패

→ hook 에러 내용을 분석하고 수정 후 **새 커밋 생성** (amend 금지)

## 9. 완료 보고

```
커밋 완료:
- 브랜치: [branch]
- 커밋: [hash] [message]
- 파일: N개 변경
- 푸시: 성공/실패
```
