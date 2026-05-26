"""
my-shushu 데이터에서 특정 날짜 이전 상품 삭제

실행 예시:
  python3 cleanup.py                    # 날짜 대화식 입력
  python3 cleanup.py --before 2026-05-10  # 2026-05-10 이전 상품 삭제
"""
import argparse
import json
import os
import sys
from datetime import date

CATALOG_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "my-shushu", "public", "data")


def cleanup(before: date) -> None:
    brands_dir = os.path.join(CATALOG_DATA_DIR, "i54", "brands")
    brands_json_path = os.path.join(CATALOG_DATA_DIR, "brands.json")

    if not os.path.exists(brands_dir):
        print("브랜드 데이터 디렉터리가 없습니다.")
        return

    removed_total = 0
    removed_brands: list[str] = []

    for fname in sorted(os.listdir(brands_dir)):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(brands_dir, fname)
        with open(fpath, encoding="utf-8") as f:
            products = json.load(f)

        kept = []
        for p in products:
            mfg = p.get("mfg_date", "")
            try:
                if mfg and date.fromisoformat(mfg) < before:
                    removed_total += 1
                    continue
            except ValueError:
                pass
            kept.append(p)

        brand_name = fname[:-5]
        if not kept:
            os.remove(fpath)
            removed_brands.append(brand_name)
            print(f"  {brand_name}: 전체 삭제 (파일 제거)")
        elif len(kept) != len(products):
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(kept, f, ensure_ascii=False, indent=2)
            print(f"  {brand_name}: {len(products) - len(kept)}개 삭제 → {len(kept)}개 남음")

    # brands.json 재생성
    existing_meta: dict[str, dict] = {}
    if os.path.exists(brands_json_path):
        with open(brands_json_path, encoding="utf-8") as f:
            for b in json.load(f):
                existing_meta[b["id"]] = b

    brand_list = []
    for fname in sorted(os.listdir(brands_dir)):
        if not fname.endswith(".json"):
            continue
        brand_name = fname[:-5]
        with open(os.path.join(brands_dir, fname), encoding="utf-8") as f:
            prods = json.load(f)
        meta = existing_meta.get(brand_name, {})
        previews = [p["thumbnail_url"] for p in prods[:3] if p.get("thumbnail_url")]
        latest_mfg_date = max(
            (p["mfg_date"] for p in prods if p.get("mfg_date")),
            default="",
        )
        brand_list.append({
            "id": brand_name,
            "name": brand_name,
            "site": "i54",
            "total": len(prods),
            "crawled_at": meta.get("crawled_at", ""),
            "latest_mfg_date": latest_mfg_date,
            "preview_thumbnails": previews,
        })
    brand_list.sort(key=lambda b: b["total"], reverse=True)

    with open(brands_json_path, "w", encoding="utf-8") as f:
        json.dump(brand_list, f, ensure_ascii=False, indent=2)

    print(f"\n완료: 상품 {removed_total}개 삭제"
          + (f", 브랜드 {len(removed_brands)}개 제거" if removed_brands else ""))


def parse_date_input(s: str) -> date:
    try:
        return date.fromisoformat(s.strip())
    except ValueError:
        raise ValueError(f"날짜 형식이 올바르지 않습니다: '{s}' (YYYY-MM-DD 형식으로 입력하세요)")


def main() -> None:
    parser = argparse.ArgumentParser(description="my-shushu 데이터 정리")
    parser.add_argument("--before", default=None, metavar="YYYY-MM-DD",
                        help="이 날짜 이전(미포함) mfg_date 상품 삭제")
    args = parser.parse_args()

    if args.before:
        try:
            before = parse_date_input(args.before)
        except ValueError as e:
            print(e)
            sys.exit(1)
    else:
        print("삭제 기준 날짜를 입력하세요 (이 날짜 이전 상품이 삭제됩니다)")
        raw = input("날짜 (YYYY-MM-DD): ").strip()
        try:
            before = parse_date_input(raw)
        except ValueError as e:
            print(e)
            sys.exit(1)

    print(f"\n{before} 이전 상품을 삭제합니다.")
    confirm = input("계속하시겠습니까? (y/N): ").strip().lower()
    if confirm != "y":
        print("취소했습니다.")
        sys.exit(0)

    print()
    cleanup(before)


if __name__ == "__main__":
    main()
