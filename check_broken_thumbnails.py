#!/usr/bin/env python3
"""
썸네일이 깨진 상품을 찾아 자동 삭제합니다.

삭제 기준 (기본: --mode all):
  --mode all        썸네일 + 상세이미지 전부 깨진 경우만 삭제 (기본값)
  --mode thumbnail  썸네일만 깨져도 바로 삭제

사용법:
  python3 check_broken_thumbnails.py
  python3 check_broken_thumbnails.py --mode thumbnail
  python3 check_broken_thumbnails.py --workers 20   # 동시 요청 수 조정 (기본 10)
  python3 check_broken_thumbnails.py --dry-run      # 삭제 없이 결과만 출력
"""

import json
import glob
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

DATA_DIR = 'public/data/i54/brands'
DEFAULT_WORKERS = 10
TIMEOUT = 10


def load_all_products():
    """브랜드별로 {id: product} 매핑과 파일 경로를 함께 반환"""
    brand_data = {}  # brand_name -> {path, full_path, products, full_products}
    for path in sorted(glob.glob(f'{DATA_DIR}/*.json')):
        if 'full' in path:
            continue
        full_path = path.replace('.json', '.full.json')
        with open(path, encoding='utf-8') as f:
            products = json.load(f)
        try:
            with open(full_path, encoding='utf-8') as f:
                full_products = json.load(f)
        except FileNotFoundError:
            full_products = []

        full_by_id = {p['id']: p for p in full_products}
        brand_name = products[0]['brand'] if products else path
        brand_data[brand_name] = {
            'path': path,
            'full_path': full_path,
            'products': products,
            'full_by_id': full_by_id,
        }
    return brand_data


def is_url_ok(url):
    if not url:
        return False
    try:
        req = urllib.request.Request(url, method='HEAD')
        req.add_header('User-Agent', 'Mozilla/5.0')
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            return res.status == 200 and 'image' in res.headers.get('Content-Type', '')
    except Exception:
        return False


def check_thumbnail(product):
    ok = is_url_ok(product.get('thumbnail_url', ''))
    return product, ok


def check_all_images(product, full_by_id):
    """thumbnail + 모든 detail_images 중 하나라도 살아있으면 False(삭제 안 함)"""
    if is_url_ok(product.get('thumbnail_url', '')):
        return False  # 썸네일 살아있음

    full = full_by_id.get(product['id'], {})
    detail_images = full.get('detail_images', [])
    for url in detail_images:
        if is_url_ok(url):
            return False  # 상세이미지 중 하나라도 살아있음

    return True  # 전부 깨짐 → 삭제 대상


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def main():
    workers = DEFAULT_WORKERS
    dry_run = '--dry-run' in sys.argv
    mode = 'all'
    if '--mode' in sys.argv:
        idx = sys.argv.index('--mode')
        mode = sys.argv[idx + 1]
        if mode not in ('all', 'thumbnail'):
            print(f'오류: --mode 값은 all 또는 thumbnail 이어야 합니다.')
            sys.exit(1)
    if '--workers' in sys.argv:
        idx = sys.argv.index('--workers')
        workers = int(sys.argv[idx + 1])

    mode_desc = '썸네일만 깨져도 삭제' if mode == 'thumbnail' else '썸네일 + 상세이미지 전부 깨진 경우만 삭제'
    if dry_run:
        print(f'[dry-run 모드: 실제 삭제 없이 결과만 출력 / {mode_desc}]\n')
    else:
        print(f'[삭제 기준: {mode_desc}]\n')

    brand_data = load_all_products()
    all_products = [(brand, p) for brand, bd in brand_data.items() for p in bd['products']]
    total = len(all_products)
    print(f'총 {total}개 상품 썸네일 검사 중... (동시 요청 {workers}개)')

    # 1단계: 썸네일 검사
    broken_thumbnail = []
    ok_thumbnail_ids = set()
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(check_thumbnail, p): brand for brand, p in all_products}
        for future in as_completed(futures):
            product, ok = future.result()
            done += 1
            if not ok:
                broken_thumbnail.append(product)
            else:
                ok_thumbnail_ids.add(product['id'])
            print(f'\r  1단계 진행: {done}/{total}', end='', flush=True)
    print()

    if not broken_thumbnail:
        print('\n✅ 모든 썸네일 정상')
        return

    if mode == 'thumbnail':
        to_delete = broken_thumbnail
    else:
        print(f'\n썸네일 깨진 상품 {len(broken_thumbnail)}개 → 상세이미지 추가 검사 중...')

        # 2단계: 상세이미지까지 검사
        to_delete = []
        done = 0
        full_by_id_map = {}
        for bd in brand_data.values():
            full_by_id_map.update(bd['full_by_id'])

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(check_all_images, p, full_by_id_map): p
                for p in broken_thumbnail
            }
            for future in as_completed(futures):
                product = futures[future]
                done += 1
                if future.result():
                    to_delete.append(product)
                print(f'\r  2단계 진행: {done}/{len(broken_thumbnail)}', end='', flush=True)
        print()

        if not to_delete:
            print('\n✅ 썸네일은 깨졌지만 상세이미지가 살아있는 상품만 있음 — 삭제 없음')
            return

    delete_ids = {p['id'] for p in to_delete}
    to_delete.sort(key=lambda p: (p['brand'], p['name']))

    print(f'\n{"[dry-run] " if dry_run else ""}🗑️  전체 이미지 깨진 상품 {len(to_delete)}개 {"(삭제 예정)" if dry_run else "삭제"}:\n')
    for p in to_delete:
        print(f"  [{p['brand']}] {p['name']}  (ID: {p['id']})")

    if dry_run:
        return

    # 3단계: 브랜드별 .json / .full.json 삭제
    for brand, bd in brand_data.items():
        original_count = len(bd['products'])
        bd['products'] = [p for p in bd['products'] if p['id'] not in delete_ids]
        bd['full_by_id'] = {k: v for k, v in bd['full_by_id'].items() if k not in delete_ids}

        if len(bd['products']) != original_count:
            save_json(bd['path'], bd['products'])
            save_json(bd['full_path'], list(bd['full_by_id'].values()))
            print(f"  저장: {bd['path']} ({original_count} → {len(bd['products'])}개)")

    # 4단계: brands.json 갱신 (total, preview_thumbnails, latest_mfg_date)
    brands_path = 'public/data/brands.json'
    with open(brands_path, encoding='utf-8') as f:
        brands = json.load(f)

    updated_brands = []
    for b in brands:
        brand_name = b['id']
        bd = brand_data.get(brand_name)
        if not bd:
            updated_brands.append(b)
            continue

        remaining = bd['products']
        if not remaining:
            print(f"  브랜드 삭제: {brand_name} (상품 0개)")
            continue

        # preview_thumbnails는 썸네일이 정상인 상품 우선, 부족하면 나머지로 채움
        ok_products = [p for p in remaining if p['id'] in ok_thumbnail_ids]
        fallback = [p for p in remaining if p['id'] not in ok_thumbnail_ids]
        preview_pool = (ok_products + fallback)[:3]

        b['total'] = len(remaining)
        b['preview_thumbnails'] = [p['thumbnail_url'] for p in preview_pool]
        b['latest_mfg_date'] = max(
            (p.get('mfg_date', '') for p in remaining), default=b.get('latest_mfg_date', '')
        )
        updated_brands.append(b)

    save_json(brands_path, updated_brands)
    print(f"  저장: {brands_path}")

    # 5단계: soldout.json 정리
    soldout_path = 'public/data/soldout.json'
    try:
        with open(soldout_path, encoding='utf-8') as f:
            soldout = json.load(f)
        cleaned = [sid for sid in soldout if sid not in delete_ids]
        if len(cleaned) != len(soldout):
            save_json(soldout_path, cleaned)
            print(f"  저장: {soldout_path} (품절 목록 {len(soldout) - len(cleaned)}개 제거)")
    except FileNotFoundError:
        pass

    print(f'\n완료: {len(to_delete)}개 상품 삭제됨')


if __name__ == '__main__':
    main()
