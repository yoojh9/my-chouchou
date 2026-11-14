#!/usr/bin/env python3
"""
배포된 라이브 사이트(my-chouchou.com)에 커밋 변경분이 실제로 반영됐는지 확인한다.

사용법:
  python3 verify_live.py {이전 커밋} [대상 커밋, 기본 HEAD]

  - 두 커밋 사이에 바뀐 public/ 파일을 라이브에서 받아 sha256 비교 (삭제된 파일은 404여야 정상)
  - CDN 반영 지연·일시 오류(503 등)가 있어, 안 맞는 파일은 잠시 뒤 다시 확인한다
  - brands.json 기준 신규 브랜드(상품 수)와 빠진 브랜드(원인: 상품 제조일)를 보여준다
  - 불일치가 남으면 종료 코드 1

push_and_deploy.sh가 배포 완료 뒤 자동으로 실행한다.
"""

import hashlib
import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = 'https://my-chouchou.com/'
RETRIES = 4        # 안 맞는 파일을 다시 확인하는 횟수
RETRY_WAIT = 10    # 초


def git(*args):
    return subprocess.run(['git', *args], capture_output=True)


def load_json(ref, path):
    r = git('show', f'{ref}:{path}')
    return json.loads(r.stdout) if r.returncode == 0 else None


def changed_public_files(prev, head):
    out = git('diff', '--name-status', '-z', f'{prev}..{head}').stdout.decode()
    parts = out.split('\0')
    items = []
    i = 0
    while i < len(parts) - 1:
        status, path = parts[i], parts[i + 1]
        i += 2
        if status.startswith('R'):  # 이름 변경은 새 경로가 한 칸 더 온다
            path = parts[i]
            i += 1
        if path.startswith('public/'):
            items.append((status[0], path))
    return items


def is_live(status, path, head):
    url = SITE + urllib.parse.quote(path[len('public/'):]) + f'?t={time.time_ns()}'  # 캐시 우회
    try:
        data, code = urllib.request.urlopen(url, timeout=30).read(), 200
    except urllib.error.HTTPError as e:
        data, code = None, e.code
    except urllib.error.URLError as e:
        data, code = None, str(e.reason)
    if status == 'D':
        return code == 404, code
    local = git('show', f'{head}:{path}').stdout
    return data is not None and hashlib.sha256(data).digest() == hashlib.sha256(local).digest(), code


def check_files(prev, head):
    items = changed_public_files(prev, head)
    pending = items
    codes = {}
    for attempt in range(RETRIES + 1):
        if attempt:
            print(f'   불일치 {len(pending)}개 — {RETRY_WAIT}초 뒤 다시 확인 ({attempt}/{RETRIES})')
            time.sleep(RETRY_WAIT)
        still = []
        for status, path in pending:
            ok, code = is_live(status, path, head)
            if not ok:
                still.append((status, path))
                codes[path] = code
        pending = still
        if not pending:
            break

    print(f'▶ public 파일 {len(items)}개: 일치 {len(items) - len(pending)} / 불일치 {len(pending)}')
    for status, path in pending:
        print(f'   ❌ [{status}] {path} (응답 {codes[path]})')
    return not pending


def report_brands(prev, head):
    old_list = load_json(prev, 'public/data/brands.json')
    new_list = load_json(head, 'public/data/brands.json')
    if old_list is None or new_list is None:
        return
    old = {b['id'] for b in old_list}
    new = {b['id'] for b in new_list}
    print(f'▶ 브랜드 수: {len(old)} → {len(new)}')

    added = sorted(new - old)
    if added:
        print(f'   신규 {len(added)}개:')
        for b in added:
            print(f'     {b}: 상품 {len(load_json(head, f"public/data/i54/brands/{b}.json") or [])}개')

    removed = sorted(old - new)
    if removed:
        # 보통 run.sh의 --purge 날짜가 앞당겨져 브랜드 상품이 전부 삭제된 경우다
        print(f'   빠짐 {len(removed)}개 (이전 상품의 제조일로 원인 확인):')
        for b in removed:
            before = load_json(prev, f'public/data/i54/brands/{b}.full.json') or []
            after = load_json(head, f'public/data/i54/brands/{b}.full.json')
            dates = sorted({p.get('mfg_date', '') for p in before})
            span = f'{dates[0]}~{dates[-1]}' if dates else '-'
            now = f'{len(after)}개' if after is not None else '파일 없음'
            print(f'     {b}: 이전 {len(before)}개 (제조일 {span}) → 지금 {now}')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    prev = sys.argv[1]
    head = sys.argv[2] if len(sys.argv) > 2 else 'HEAD'

    print(f'▶ 라이브 검증: {prev[:7]}..{head[:7]}')
    ok = check_files(prev, head)
    report_brands(prev, head)
    if ok:
        print('✅ 라이브 반영 확인')
    else:
        print('⚠️  라이브에 반영되지 않은 파일이 있습니다')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
