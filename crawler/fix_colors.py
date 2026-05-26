"""
기존 크롤링 데이터 중 colors 가 'N색상' 패턴인 상품을 재방문하여
실제 색상 값을 채워 넣는 스크립트.

실행 예시:
  python3 fix_colors.py                # output/ 전체 대상
  python3 fix_colors.py --headed       # 브라우저 보이게
  python3 fix_colors.py --dry-run      # 수정 없이 대상 목록만 출력
"""
import argparse
import asyncio
import json
import os
import re

from dotenv import load_dotenv
from playwright.async_api import async_playwright

import crawler as cr

load_dotenv()

OUTPUT_DIR = "output"
CATALOG_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")

COLOR_COUNT_RE = re.compile(r"^\d+색상$")


def needs_fix(colors: str) -> bool:
    return not colors or COLOR_COUNT_RE.match(colors.strip())


async def fetch_colors(page, product_url: str) -> tuple[list[dict], str]:
    """상세 페이지에서 size_options(colors 포함)와 colors 합집합 문자열 반환."""
    await page.goto(product_url, wait_until="domcontentloaded")


    size_options_raw = await page.evaluate("""
        () => {
            const sel = document.querySelector('select[name="option1"]');
            if (!sel) return [];
            return Array.from(sel.options)
                .filter(o => o.value && o.value !== '' && !o.text.includes('선택해 주세요') && !/^-+$/.test(o.text.trim()))
                .map(o => {
                    const text = o.text.trim();
                    const addM = text.match(/\\(\\+([\\d,]+)\\)/);
                    const add_price = addM ? parseInt(addM[1].replace(/,/g, '')) : 0;
                    const name = text.replace(/\\s*\\(.*\\)/, '').trim();
                    return { name, add_price, value: o.value };
                });
        }
    """)

    def read_option2_js():
        return """
            () => {
                const sel = document.querySelector('select[name="option2"]');
                if (!sel) return [];
                return Array.from(sel.options)
                    .filter(o => o.value && o.value !== '' && !o.text.includes('선택해 주세요') && !/^-+$/.test(o.text.trim()))
                    .map(o => o.text.trim().replace(/\\s*\\(.*\\)/, '').trim())
                    .filter(t => t.length > 0);
            }
        """

    # option1이 자동 선택된 경우 option2가 이미 채워져 있을 수 있음
    preloaded = await page.evaluate(read_option2_js())
    if preloaded:
        for opt in size_options_raw:
            opt["colors"] = preloaded
    else:
        for opt in size_options_raw:
            try:
                await page.select_option('select[name="option1"]', opt["value"])
                await page.wait_for_timeout(600)
            except Exception:
                pass
            opt["colors"] = await page.evaluate(read_option2_js())

    size_options = [{"name": o["name"], "add_price": o["add_price"], "colors": o["colors"]} for o in size_options_raw]

    seen: set[str] = set()
    all_colors: list[str] = []
    for o in size_options:
        for c in o["colors"]:
            if c not in seen:
                seen.add(c)
                all_colors.append(c)
    colors_str = "/".join(all_colors)

    return size_options, colors_str


def collect_target_files() -> list[str]:
    files = []
    for fname in os.listdir(OUTPUT_DIR):
        if fname.startswith("products_") and fname.endswith(".json"):
            files.append(os.path.join(OUTPUT_DIR, fname))
    return sorted(files)


def save_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def update_catalog(product: dict) -> None:
    """카탈로그 데이터(catalog/public/data/i54/brands/)의 해당 상품도 업데이트."""
    brand = product.get("brand")
    if not brand:
        return
    brand_file = os.path.join(CATALOG_DATA_DIR, "i54", "brands", f"{brand}.json")
    if not os.path.exists(brand_file):
        return
    with open(brand_file, encoding="utf-8") as f:
        prods = json.load(f)
    updated = False
    for p in prods:
        if p.get("id") == product["id"]:
            p["colors"] = product["colors"]
            p["size_options"] = product["size_options"]
            updated = True
            break
    if updated:
        save_json(brand_file, prods)


async def run(headed: bool, dry_run: bool) -> None:
    id_ = os.getenv("I54_ID")
    pw = os.getenv("I54_PW")
    if not id_ or not pw:
        raise RuntimeError(".env 파일에 I54_ID, I54_PW를 설정하세요.")

    files = collect_target_files()
    targets: list[tuple[str, dict]] = []  # (json_path, product)
    for fpath in files:
        with open(fpath, encoding="utf-8") as f:
            data = json.load(f)
        for p in data.get("products", []):
            if needs_fix(p.get("colors", "")):
                targets.append((fpath, p))

    print(f"재수집 대상: {len(targets)}개 상품")
    if dry_run:
        for fpath, p in targets:
            print(f"  {p['id']} | {p['brand']} | {p['name']} | colors={p['colors']!r}")
        return

    if not targets:
        print("수정할 상품 없음.")
        return

    async with async_playwright() as pw_:
        browser = await pw_.chromium.launch(
            headless=not headed,
            args=["--disable-blink-features=AutomationControlled"],
        )
        ctx = await browser.new_context(
            ignore_https_errors=True,
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="ko-KR",
        )
        await ctx.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = await ctx.new_page()
        await cr.login(page, id_, pw)

        # output JSON 파일별로 변경 추적
        file_data: dict[str, dict] = {}
        for fpath, _ in targets:
            if fpath not in file_data:
                with open(fpath, encoding="utf-8") as f:
                    file_data[fpath] = json.load(f)

        for i, (fpath, product) in enumerate(targets, 1):
            pid = product["id"]
            print(f"[{i}/{len(targets)}] {product['brand']} / {product['name']} ({pid}) ...")
            try:
                size_options, colors_str = await fetch_colors(page, product["product_url"])
                print(f"  → colors: {colors_str or '(없음)'}")

                # output JSON 인메모리 업데이트
                for p in file_data[fpath]["products"]:
                    if p.get("id") == pid:
                        if colors_str:
                            p["colors"] = colors_str
                        p["size_options"] = size_options
                        break

                # 카탈로그 즉시 업데이트
                product_copy = dict(product)
                if colors_str:
                    product_copy["colors"] = colors_str
                product_copy["size_options"] = size_options
                update_catalog(product_copy)

            except Exception as e:
                print(f"  [SKIP] 오류: {e}")

        await browser.close()

    # 변경된 output JSON 저장
    for fpath, data in file_data.items():
        save_json(fpath, data)
        print(f"저장: {fpath}")

    print("\n완료.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="대상 목록만 출력, 수정 안 함")
    args = parser.parse_args()
    asyncio.run(run(args.headed, args.dry_run))


if __name__ == "__main__":
    main()
