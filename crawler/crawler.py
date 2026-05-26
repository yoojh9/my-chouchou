"""
i54.co.kr 크롤러 (아동복 도매)

실행 예시:
  python3 crawler.py
  python3 crawler.py --headed                                    # 브라우저 보이게
  python3 crawler.py --no-images                                 # 이미지 다운로드 스킵
  python3 crawler.py --since 2026-05-22                          # 제조일자 이후만 수집
  python3 crawler.py --since 2026-05-10 --until 2026-05-21       # 날짜 범위 수집
"""
import argparse
import asyncio
import json
import os
import re
from datetime import datetime, date

from dotenv import load_dotenv
from playwright.async_api import async_playwright

import downloader as dl

load_dotenv()

BASE_URL = "https://i54.co.kr"
# sort_method=5: 신상품순
LIST_URL = f"{BASE_URL}/product/list.html?cate_no=2513&sort_method=5"
OUTPUT_DIR = "output"


# ── 유틸 ─────────────────────────────────────────────────────────────────────

def parse_price(text: str | None) -> int | None:
    if not text:
        return None
    nums = re.sub(r"[^\d]", "", text)
    return int(nums) if nums else None


def parse_product_name(raw: str) -> tuple[str, str, str, str]:
    """raw 상품명 → (brand, name, colors, size_range)
    예: '스튜디오엠.해지투웨이원피스[스트라이프]*S~2XL*'
    → brand='스튜디오엠', name='스튜디오엠.해지투웨이원피스', colors='스트라이프', size_range='S~2XL'
    """
    text = raw.strip().replace("\n", "")
    color_m = re.search(r"\[([^\]]+)\]", text)
    size_m = re.search(r"\*([^*]+)\*", text)
    raw_color = color_m.group(1) if color_m else ""
    # '4색상', '12색상' 같은 개수 표기는 상세 페이지에서 실제 색상을 수집
    colors = "" if re.fullmatch(r"\d+색상", raw_color) else raw_color
    size_range = size_m.group(1) if size_m else ""
    name = re.split(r"[\[\*]", text)[0].strip()
    brand = name.split(".")[0].strip() if "." in name else name
    return brand, name, colors, size_range


def extract_product_id(href: str) -> str | None:
    """URL에서 상품 ID 추출.
    - /product/slug/1234567/category/... 형태
    - ?product_no=1234567 형태 모두 지원
    """
    m = re.search(r"product_no=(\d+)", href)
    if m:
        return m.group(1)
    # /product/slug/숫자/ 형태
    m = re.search(r"/product/[^/]+/(\d+)/", href)
    if m:
        return m.group(1)
    return None


# ── 로그인 ────────────────────────────────────────────────────────────────────

async def login(page, id_: str, pw: str) -> None:
    print("로그인 중...")
    await page.goto(f"{BASE_URL}/member/login.html", wait_until="domcontentloaded")
    await page.fill("input[name='member_id']", id_)
    await page.fill("input[name='member_passwd']", pw)
    await page.locator("a.btnLogin").click()
    await page.wait_for_load_state("networkidle", timeout=15000)

    logged_in = await page.locator("a[href*='logout']").count()
    if not logged_in:
        raise RuntimeError("로그인 실패. I54_ID/I54_PW를 확인하세요.")
    print("  로그인 성공")


# ── 상품 목록 페이지 파싱 ──────────────────────────────────────────────────────

async def parse_product_list(page) -> list[dict]:
    try:
        await page.wait_for_selector("ul.prdList li", timeout=10000)
    except Exception:
        return []

    raw_cards = await page.evaluate("""
        () => Array.from(document.querySelectorAll('ul.prdList li')).map(li => {
            // 상품 링크: /product/slug/id/category/... 형태
            const link = li.querySelector('div.prdImg a, a[href*="/product/"]');

            // 상품명: strong.name a 안의 마지막 span (displaynone 제외)
            const nameA = li.querySelector('strong.name a');
            const nameSpans = nameA
                ? Array.from(nameA.querySelectorAll('span')).filter(s => !s.className.includes('displaynone') && !s.className.includes('title'))
                : [];
            const nameText = nameSpans.length
                ? nameSpans[nameSpans.length - 1].innerText.trim()
                : (nameA ? nameA.innerText.trim() : '');

            // 가격: xans-product-listitem의 값 span
            let price = '';
            li.querySelectorAll('ul.xans-product-listitem li').forEach(item => {
                const label = (item.querySelector('strong.title') || {}).innerText || '';
                const valueSpan = item.querySelector(':scope > span:not(.displaynone)');
                const value = valueSpan ? valueSpan.innerText.trim() : '';
                if (label.includes('판매가')) price = value;
            });

            // 썸네일: prdImg 안의 첫 번째 img (버튼 이미지 제외)
            const thumbEl = li.querySelector('div.prdImg img');

            return {
                href:  link ? link.href : '',
                thumb: thumbEl ? thumbEl.src : '',
                name:  nameText,
                price: price,
            };
        })
    """)

    products = []
    for c in raw_cards:
        try:
            href = c["href"]
            if not href:
                continue
            product_id = extract_product_id(href)
            if not product_id:
                continue

            thumb_src = c["thumb"]
            if thumb_src.startswith("//"):
                thumb_src = "https:" + thumb_src

            raw_name = c["name"].strip()
            if not raw_name:
                continue
            brand, name, colors, size_range = parse_product_name(raw_name)
            price_sale = parse_price(c["price"])

            products.append({
                "id": product_id,
                "brand": brand,
                "name": name,
                "colors": colors,
                "size_range": size_range,
                "product_url": href,
                "thumbnail_url": thumb_src,
                "thumbnail_local": None,
                "price_original": None,
                "price_sale": price_sale,
                "mfg_date": "",
                "size_options": [],
                "detail_images": [],
            })
        except Exception as e:
            print(f"  [SKIP] 카드 파싱 오류: {e}")

    return products


# ── 상세 페이지 파싱 ──────────────────────────────────────────────────────────

async def fetch_detail(page, product: dict) -> None:
    try:
        await page.goto(product["product_url"], wait_until="domcontentloaded")

        # 제조일자
        mfg_th = page.locator("th:has-text('제조일자'), td:has-text('제조일자')")
        if await mfg_th.count():
            td = mfg_th.first.locator("xpath=following-sibling::td[1]")
            mfg = (await td.inner_text()).strip()
            if mfg:
                product["mfg_date"] = mfg

        # 소비자가 (원가)
        orig_th = page.locator("th:has-text('소비자가'), th:has-text('정가')")
        if await orig_th.count():
            td = orig_th.first.locator("xpath=following-sibling::td[1]")
            orig = parse_price(await td.inner_text())
            product["price_original"] = orig if orig != product["price_sale"] else None

        # 사이즈 옵션 (value 포함해서 추출 후 색상 수집에 활용)
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

        # 각 사이즈 선택 후 option2(색상) 수집
        read_option2_js = """
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
        preloaded = await page.evaluate(read_option2_js)
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
                opt["colors"] = await page.evaluate(read_option2_js)

        # size_options에서 내부용 value 제거
        size_options = [{"name": o["name"], "add_price": o["add_price"], "colors": o["colors"]} for o in size_options_raw]
        product["size_options"] = size_options

        # colors 필드 업데이트: 모든 사이즈 색상의 합집합 (순서 유지)
        if any(o["colors"] for o in size_options):
            seen_colors: set[str] = set()
            all_colors: list[str] = []
            for o in size_options:
                for c in o["colors"]:
                    if c not in seen_colors:
                        seen_colors.add(c)
                        all_colors.append(c)
            if all_colors:
                product["colors"] = "/".join(all_colors)

        # 상세 이미지 (#prdDetail 또는 .detail_image_area)
        detail_selector = "#prdDetail img, .detail_image_area img, #detail img"
        imgs = await page.locator(detail_selector).all()
        seen_srcs = set()
        for img in imgs:
            src = (await img.get_attribute("ec-data-src") or await img.get_attribute("data-src") or await img.get_attribute("src") or "").strip()
            if not src or "base64" in src:
                continue
            if src.startswith("//"):
                src = "https:" + src
            if not src.startswith("http"):
                src = BASE_URL + src
            # 아이콘/버튼 이미지 제외 (너무 작은 이미지 URL 패턴)
            if any(kw in src for kw in ["ico_", "btn_", "bullet", "echosting.cafe24.com/design"]):
                continue
            if src not in seen_srcs:
                seen_srcs.add(src)
                product["detail_images"].append({"url": src, "local": None})

    except Exception as e:
        print(f"  [SKIP] 상세 수집 오류 ({product['id']}): {e}")


# ── 최신 크롤링 날짜 자동 감지 ────────────────────────────────────────────────

def detect_latest_since() -> str:
    """output/index.json에서 가장 최근 크롤링 날짜를 읽어 since 값으로 반환.
    파일이 없으면 오늘 날짜를 반환한다.
    """
    index_path = os.path.join(OUTPUT_DIR, "index.json")
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as f:
            index = json.load(f)
        dates = index.get("dates", [])
        if dates:
            latest = sorted(dates)[-1]
            # YYYYMMDD → YYYY-MM-DD
            return f"{latest[:4]}-{latest[4:6]}-{latest[6:8]}"
    return date.today().isoformat()


def load_existing_product_ids() -> set[str]:
    """my-shushu/public/data/i54/brands/ 에서 이미 수집된 상품 ID 전체를 반환."""
    brands_dir = os.path.join(CATALOG_DATA_DIR, "i54", "brands")
    if not os.path.exists(brands_dir):
        return set()
    ids: set[str] = set()
    for fname in os.listdir(brands_dir):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(brands_dir, fname)
        try:
            with open(fpath, encoding="utf-8") as f:
                for p in json.load(f):
                    if p.get("id"):
                        ids.add(str(p["id"]))
        except Exception:
            pass
    return ids


# ── 메인 크롤 ─────────────────────────────────────────────────────────────────

async def crawl(headed: bool = False, no_images: bool = False, since: str | None = None, until: str | None = None) -> None:
    id_ = os.getenv("I54_ID")
    pw = os.getenv("I54_PW")
    if not id_ or not pw:
        raise RuntimeError(".env 파일에 I54_ID, I54_PW를 설정하세요.")

    if since is None:
        since = detect_latest_since()
        print(f"since 자동 감지: {since}")

    since_date = date.fromisoformat(since)
    until_date = date.fromisoformat(until) if until else None
    if until_date:
        print(f"날짜 범위: {since} ~ {until}")

    date_str = datetime.now().strftime("%Y%m%d")
    thumb_dir = os.path.join(OUTPUT_DIR, "images", date_str, "thumb")
    detail_dir = os.path.join(OUTPUT_DIR, "images", date_str, "detail")
    os.makedirs(thumb_dir, exist_ok=True)
    os.makedirs(detail_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
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

        await login(page, id_, pw)

        existing_ids = load_existing_product_ids()
        if existing_ids:
            print(f"기존 수집 상품 {len(existing_ids)}개 — 중복 스킵")

        filtered: list[dict] = []
        seen_ids: set[str] = set()
        page_num = 1
        stop = False

        while not stop:
            url = f"{LIST_URL}&page={page_num}"
            print(f"\n[페이지 {page_num}] {url}")
            await page.goto(url, wait_until="networkidle")

            cards = await parse_product_list(page)
            new = [c for c in cards if c["id"] not in seen_ids]
            seen_ids.update(c["id"] for c in new)

            if not new:
                print("  더 이상 상품 없음")
                break

            has_next = await page.locator("img[alt='다음 페이지']").count() > 0

            for product in new:
                if product["id"] in existing_ids:
                    print(f"  [SKIP] {product['id']} — 이미 수집된 상품")
                    continue

                # 상세 페이지에서 제조일자/이미지 수집
                print(f"  [{len(filtered)+1}] {product['brand']} / {product['name']} ({product['id']}) 상세 수집...")
                await fetch_detail(page, product)

                mfg = product.get("mfg_date", "")
                if mfg:
                    try:
                        mfg_d = date.fromisoformat(mfg)
                        if mfg_d < since_date:
                            print(f"    → 제조일자 {mfg} < {since} — 제외 후 중단")
                            stop = True
                            break
                        if until_date and mfg_d > until_date:
                            print(f"    → 제조일자 {mfg} > {until} — 스킵")
                            continue
                    except ValueError:
                        pass

                # 이미지 로컬 경로 지정
                if product["thumbnail_url"]:
                    product["thumbnail_local"] = os.path.join(thumb_dir, f"{product['id']}.jpg")
                for j, img in enumerate(product["detail_images"], 1):
                    img["local"] = os.path.join(detail_dir, f"{product['id']}_{j:02d}.jpg")

                filtered.append(product)
                print(f"    → 포함 (제조일자: {mfg}, 상세 {len(product['detail_images'])}장)")

            if stop or not has_next:
                break

            page_num += 1

        print(f"\n수집 완료: {len(filtered)}개 상품 포함")

        await browser.close()

        # ── 이미지 다운로드 ───────────────────────────────────────
        if not no_images:
            print("\n이미지 다운로드 시작...")
            await dl.download_all(filtered)

        # ── JSON 저장 ─────────────────────────────────────────────
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        brands = sorted({p["brand"] for p in filtered if p.get("brand")})
        result = {
            "date": date_str,
            "category": "오늘의 신상",
            "site": "i54.co.kr",
            "crawled_at": datetime.now().isoformat(timespec="seconds"),
            "since": since,
            "until": until,
            "total": len(filtered),
            "brands": brands,
            "products": filtered,
        }
        json_path = os.path.join(OUTPUT_DIR, f"products_{date_str}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"JSON 저장 완료: {json_path}")

        # ── index.json 업데이트 ───────────────────────────────────
        index_path = os.path.join(OUTPUT_DIR, "index.json")
        if os.path.exists(index_path):
            with open(index_path, encoding="utf-8") as f:
                index = json.load(f)
        else:
            index = {"dates": [], "brands": []}

        if date_str not in index["dates"]:
            index["dates"].insert(0, date_str)
        for b in brands:
            if b not in index["brands"]:
                index["brands"].append(b)
        index["brands"].sort()

        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        print(f"index.json 업데이트 완료")

        # ── 카탈로그 데이터 생성 ──────────────────────────────────
        generate_catalog_data(result)


# ── 카탈로그 데이터 생성 ─────────────────────────────────────────────────────────

CATALOG_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")


def generate_catalog_data(result: dict) -> None:
    from collections import defaultdict

    brands_dir = os.path.join(CATALOG_DATA_DIR, "i54", "brands")
    os.makedirs(brands_dir, exist_ok=True)

    new_products = result.get("products", [])
    brand_map: dict[str, list[dict]] = defaultdict(list)
    for p in new_products:
        brand_map[p["brand"]].append(p)

    all_brands = set(brand_map.keys())
    for brand_name in all_brands:
        if not brand_name:
            continue
        brand_file = os.path.join(brands_dir, f"{brand_name}.json")

        existing_by_id: dict[str, dict] = {}
        if os.path.exists(brand_file):
            with open(brand_file, encoding="utf-8") as f:
                for p in json.load(f):
                    existing_by_id[p["id"]] = p

        for p in brand_map.get(brand_name, []):
            existing_by_id[p["id"]] = p

        merged = sorted(existing_by_id.values(), key=lambda p: p.get("mfg_date") or "", reverse=True)
        with open(brand_file, "w", encoding="utf-8") as f:
            json.dump(merged, f, ensure_ascii=False, indent=2)

    # brands.json 재생성
    existing_brand_meta: dict[str, dict] = {}
    brands_json_path = os.path.join(CATALOG_DATA_DIR, "brands.json")
    if os.path.exists(brands_json_path):
        with open(brands_json_path, encoding="utf-8") as f:
            for b in json.load(f):
                existing_brand_meta[b["id"]] = b

    brand_list = []
    for fname in sorted(os.listdir(brands_dir)):
        if not fname.endswith(".json"):
            continue
        brand_name = fname[:-5]
        with open(os.path.join(brands_dir, fname), encoding="utf-8") as f:
            prods = json.load(f)

        previews = [p["thumbnail_url"] for p in prods[:3] if p.get("thumbnail_url")]
        crawled_at = (
            result["crawled_at"] if brand_name in brand_map
            else existing_brand_meta.get(brand_name, {}).get("crawled_at", result["crawled_at"])
        )
        latest_mfg_date = max(
            (p["mfg_date"] for p in prods if p.get("mfg_date")),
            default="",
        )
        brand_list.append({
            "id": brand_name,
            "name": brand_name,
            "site": "i54",
            "total": len(prods),
            "crawled_at": crawled_at,
            "latest_mfg_date": latest_mfg_date,
            "preview_thumbnails": previews,
        })
    brand_list.sort(key=lambda b: b["total"], reverse=True)

    with open(brands_json_path, "w", encoding="utf-8") as f:
        json.dump(brand_list, f, ensure_ascii=False, indent=2)

    total = sum(b["total"] for b in brand_list)
    print(f"카탈로그 데이터 갱신 완료: {len(brand_list)}개 브랜드, 총 {total}개 상품")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="i54.co.kr 아동복 크롤러")
    parser.add_argument("--headed", action="store_true", help="브라우저 창 표시")
    parser.add_argument("--no-images", action="store_true", help="이미지 다운로드 스킵")
    parser.add_argument("--since", default=None, metavar="YYYY-MM-DD",
                        help="이 날짜 이후 제조 상품만 수집 (기본: 마지막 크롤링 날짜 자동 감지)")
    parser.add_argument("--until", default=None, metavar="YYYY-MM-DD",
                        help="이 날짜 이하 제조 상품만 수집 (since와 함께 사용하면 날짜 범위 지정)")
    args = parser.parse_args()
    asyncio.run(crawl(headed=args.headed, no_images=args.no_images, since=args.since, until=args.until))


if __name__ == "__main__":
    main()
