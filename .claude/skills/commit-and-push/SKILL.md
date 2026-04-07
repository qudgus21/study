---
name: commit-and-push
description: staged 변경사항을 커밋하고 main에 푸시합니다. 확인 없이 즉시 실행합니다.
---

staged 변경사항을 커밋 메시지 작성 후 즉시 main에 푸시합니다. **사용자에게 아무것도 묻지 않고 바로 실행합니다.**

## 실행 절차

1. `git diff --staged --stat`과 `git log --oneline -5` 실행
2. staged 변경이 없으면 "staged 변경사항이 없습니다." 안내 후 **중단**
3. diff 내용과 기존 커밋 스타일을 참고하여 커밋 메시지 작성
4. 커밋 및 푸시

## 커밋 메시지 규칙

- conventional commit 스타일: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` 등
- 기존 커밋 스타일(한글/영어)을 따름
- 1-2문장으로 간결하게, "왜" 변경했는지에 집중
- Co-Authored-By 태그 포함

## 커밋 및 푸시

```bash
git commit -m "$(cat <<'EOF'
커밋 메시지

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"

git push
```

## 에러 처리

- push 실패 (diverge) → `git pull --rebase` 후 재시도. **절대 force push 금지.**
- pre-commit hook 실패 → 에러 분석 후 수정, **새 커밋 생성** (amend 금지)

## 완료 보고

```
커밋 완료:
- 커밋: [hash] [message]
- 파일: N개 변경
- 푸시: 성공/실패
```
