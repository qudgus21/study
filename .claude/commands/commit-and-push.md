변경사항을 커밋하고 푸시까지 한번에 수행합니다.

## 절차

1. `git status`로 변경된 파일 확인 (untracked 포함)
2. `git diff`와 `git diff --staged`로 변경 내용 파악
3. `git log --oneline -5`로 최근 커밋 메시지 스타일 확인
4. 변경 내용을 분석하여 적절한 커밋 메시지 작성
   - feat/fix/refactor/docs 등 conventional commit 스타일
   - 한글 또는 영어는 기존 커밋 스타일을 따름
5. 민감한 파일(.env, credentials, secret key 등)은 제외하고 경고
6. 변경된 파일을 스테이징하고 커밋 생성
   - Co-Authored-By 태그 포함
7. 현재 브랜치의 리모트로 push
   - 리모트 브랜치가 없으면 `-u origin <branch>` 사용
8. push 결과 확인 후 완료 보고
