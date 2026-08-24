#!/bin/bash
# push_and_deploy.sh
# 수정한 파일 전부 커밋·푸시하고 GitHub Pages 배포 완료까지 확인한다.
#   - 커밋 메시지의 날짜는 run.sh의 page_crawl_YYYY-MM-DD.xlsx 에서 자동 추출
#   - 변경사항이 없으면 커밋을 건너뛰고 현재 HEAD의 배포 상태만 확인
#   - GITHUB_TOKEN 환경변수가 있으면 인증 요청(API rate limit 완화)
set -eo pipefail
cd "$(dirname "$0")"

REMOTE="origin"
BRANCH="main"
REPO="yoojh9/my-chouchou"
POLL_INTERVAL=20   # 초
MAX_TRIES=30       # 20초 * 30 = 최대 10분 대기

# --- 0. 브랜치 확인 (main에서만 실행) ---
CUR_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CUR_BRANCH" != "$BRANCH" ]; then
  echo "❌ 현재 브랜치가 '$CUR_BRANCH' 입니다. '$BRANCH'에서만 실행하세요."
  exit 1
fi

# --- 1. run.sh에서 크롤 날짜 추출 (주석 줄 제외) ---
CRAWL_DATE=$(grep -vE '^[[:space:]]*#' run.sh \
  | grep -oE 'page_crawl_[0-9]{4}-[0-9]{2}-[0-9]{2}' \
  | head -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
if [ -z "$CRAWL_DATE" ]; then
  echo "❌ run.sh에서 크롤 날짜(page_crawl_YYYY-MM-DD)를 찾지 못했습니다."
  exit 1
fi

# --- 2. 커밋 & 푸시 ---
if [ -n "$(git status --porcelain)" ]; then
  COUNT=$(git status --porcelain | wc -l | tr -d ' ')
  echo "▶ 변경 파일 ${COUNT}개 커밋·푸시 (크롤 날짜: ${CRAWL_DATE})"
  git add -A
  git commit -q -m "chore: ${CRAWL_DATE} 크롤링 데이터 반영

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  git push "$REMOTE" "$BRANCH"
else
  echo "ℹ 커밋할 변경사항이 없습니다. 현재 HEAD의 배포 상태만 확인합니다."
fi

SHA=$(git rev-parse HEAD)
echo "▶ 대상 커밋: ${SHA:0:7}"

# --- 3. GitHub Actions 배포 완료까지 폴링 ---
API="https://api.github.com/repos/${REPO}/actions/runs?head_sha=${SHA}&per_page=1"
echo "▶ GitHub Pages 배포 확인 중... (최대 $((POLL_INTERVAL * MAX_TRIES / 60))분)"

for i in $(seq 1 "$MAX_TRIES"); do
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    RESP=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" "$API") || RESP=""
  else
    RESP=$(curl -s "$API") || RESP=""
  fi

  # strict=False 로 커밋 메시지의 개행문자가 섞여도 안전하게 파싱
  RESULT=$(printf '%s' "$RESP" | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read(), strict=False)
except Exception as e:
    print('ERROR', 'parse:', e); sys.exit()
runs = d.get('workflow_runs')
if runs is None:
    print('ERROR', d.get('message', 'unknown'))
elif not runs:
    print('WAITING none')
else:
    w = runs[0]
    print(w['status'], w.get('conclusion') or '-', w['html_url'])
" 2>/dev/null) || RESULT="ERROR parse-failed"

  STATUS=$(printf '%s' "$RESULT" | awk '{print $1}')
  case "$STATUS" in
    completed)
      CONCLUSION=$(printf '%s' "$RESULT" | awk '{print $2}')
      URL=$(printf '%s' "$RESULT" | awk '{print $3}')
      if [ "$CONCLUSION" = "success" ]; then
        echo "✅ 배포 완료: success"
        echo "   $URL"
        exit 0
      else
        echo "⚠️  배포 종료: $CONCLUSION (실패)"
        echo "   $URL"
        exit 1
      fi
      ;;
    ERROR)
      echo "   [$i/$MAX_TRIES] API 오류: ${RESULT#ERROR }"
      ;;
    WAITING)
      echo "   [$i/$MAX_TRIES] 워크플로우 등록 대기 중..."
      ;;
    *)
      echo "   [$i/$MAX_TRIES] 진행 중... ($STATUS)"
      ;;
  esac
  sleep "$POLL_INTERVAL"
done

echo "⏱  ${MAX_TRIES}회 확인했지만 완료를 확인하지 못했습니다. 직접 확인하세요:"
echo "   https://github.com/${REPO}/actions"
exit 1
