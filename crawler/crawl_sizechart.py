"""
i54.co.kr 사이즈표 게시판 크롤러

https://i54.co.kr/board/free/list.html?board_no=3001
에서 번호 28 이상 게시글의 사이즈표 이미지를 수집한다.

실행:
  python3 crawl_sizechart.py
"""
import asyncio
import json
import os
import re

from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

BASE_URL = "https://i54.co.kr"
BOARD_URL = f"{BASE_URL}/board/free/list.html?board_no=3001&page={{page}}"
OUTPUT_PATH = "output/sizecharts.json"
MIN_POST_NO = 28   # 이 번호 이상만 수집
MAX_PAGES = 3      # 최대 페이지


# ── 로그인 ────────────────────────────────────────────────────────────────────

async def login(page, id_: str, pw: str) -> None:
    print("로그인 중...")
    await page.goto(f"{BASE_URL}/member/login.html", wait_until="domcontentloaded")
    await page.fill("input[name='member_id']", id_)
    await page.fill("input[name='member_passwd']", pw)
    await page.locator("a.btnLogin").click()
    await page.wait_for_load_state("networkidle", timeout=15000)
    if not await page.locator("a[href*='logout']").count():
        raise RuntimeError("로그인 실패. I54_ID/I54_PW를 확인하세요.")
    print("  로그인 성공")


# ── 게시판 목록 파싱 ──────────────────────────────────────────────────────────

async def parse_board_list(page) -> list[dict]:
    """현재 목록 페이지에서 게시글 번호, 제목, URL 추출."""
    await page.wait_for_selector("tbody.xans-board-list tr.xans-record-", timeout=10000)

    return await page.evaluate("""
        () => Array.from(document.querySelectorAll('tbody.xans-board-list tr.xans-record-')).map(tr => {
            const tds = tr.querySelectorAll('td');
            const numText = tds[0] ? tds[0].innerText.trim() : '';
            const link = tr.querySelector('td.subject a');
            return {
                no: parseInt(numText) || 0,
                title: link ? link.innerText.trim() : '',
                href: link ? link.href : '',
            };
        }).filter(r => r.no > 0 && r.href)
    """)


# ── 게시글 상세 이미지 수집 (페이지네이션 포함) ────────────────────────────────

async def fetch_article_images(page, href: str) -> list[str]:
    """게시글의 모든 페이지에서 콘텐츠 이미지 URL 목록 반환."""
    images = []
    seen = set()

    # href에서 article_no 추출 (페이지 순회에 사용)
    # 예: /article/사이즈-가이드/3001/9663/page/1/
    base_href = re.sub(r"/page/\d+/?$", "", href.rstrip("/"))
    article_url_base = f"{BASE_URL}{base_href}" if base_href.startswith("/") else base_href

    page_no = 1
    while True:
        url = f"{article_url_base}/page/{page_no}/"
        await page.goto(url, wait_until="networkidle")

        # 콘텐츠 이미지: NNEditor 업로드 경로 또는 product/big 경로
        imgs = await page.evaluate("""
            () => Array.from(document.querySelectorAll('.xans-board-read img')).map(img => img.src)
                .filter(src =>
                    src &&
                    !src.includes('echosting') &&
                    !src.includes('ico_') &&
                    !src.includes('/web/jjh/') &&
                    !src.includes('se_bu') &&
                    !src.includes('foot-') &&
                    !src.includes('top-') &&
                    !src.includes('category/6920') &&
                    !src.includes('icon_hit') &&
                    !src.includes('ico_point') &&
                    !src.includes('btn_') &&
                    !src.includes('foot-logo') &&
                    !src.includes('4fd69f1d')  /* 로고 gif */
                )
        """)
        for src in imgs:
            if src.startswith("//"):
                src = "https:" + src
            if src not in seen:
                seen.add(src)
                images.append(src)

        # 다음 페이지 존재 여부 확인
        next_page = await page.evaluate(f"""
            () => {{
                const links = Array.from(document.querySelectorAll('a[href*="page/{page_no + 1}"]'));
                return links.length > 0;
            }}
        """)
        if not next_page:
            break
        page_no += 1

    return images


# ── 브랜드명 정규화 ───────────────────────────────────────────────────────────

def normalize_brand(title: str) -> str:
    """제목에서 브랜드명 추출.
    예: '아토메메 사이즈표' → '아토메메'
        '2025 디그린 사이즈표' → '디그린'
        '플로아동복사이즈표' → '플로'
    """
    # 연도 제거
    t = re.sub(r"^\d{4}\s*", "", title.strip())
    # '사이즈표', '사이즈 가이드', '모델인포' 등 접미사 제거
    t = re.sub(r"\s*(사이즈표|사이즈\s*가이드|모델인포|사이즈|가이드).*$", "", t, flags=re.I)
    # '아동복' 접미사 제거
    t = re.sub(r"아동복$", "", t.strip())
    return t.strip()


# ── 메인 크롤 ─────────────────────────────────────────────────────────────────

async def crawl() -> None:
    id_ = os.getenv("I54_ID")
    pw = os.getenv("I54_PW")
    if not id_ or not pw:
        raise RuntimeError(".env 파일에 I54_ID, I54_PW를 설정하세요.")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
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

        # ── 목록 수집 ─────────────────────────────────────────────
        posts = []
        stop = False
        for pg in range(1, MAX_PAGES + 1):
            url = BOARD_URL.format(page=pg)
            print(f"\n[목록 페이지 {pg}] {url}")
            await page.goto(url, wait_until="networkidle")

            rows = await parse_board_list(page)
            for row in rows:
                if row["no"] < MIN_POST_NO:
                    print(f"  → 번호 {row['no']} < {MIN_POST_NO} — 중단")
                    stop = True
                    break
                posts.append(row)
                print(f"  [{row['no']}] {row['title']}")
            if stop:
                break

        print(f"\n총 {len(posts)}개 게시글 수집")

        # ── 각 게시글 이미지 수집 ─────────────────────────────────
        results = {}
        for post in posts:
            brand = normalize_brand(post["title"])
            print(f"\n  [{post['no']}] {post['title']} → 브랜드: '{brand}'")
            imgs = await fetch_article_images(page, post["href"])
            print(f"    이미지 {len(imgs)}장")
            results[brand] = {
                "no": post["no"],
                "title": post["title"],
                "url": post["href"],
                "images": imgs,
            }

        await browser.close()

    # ── 저장 ──────────────────────────────────────────────────────
    os.makedirs("output", exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n저장 완료: {OUTPUT_PATH} ({len(results)}개 브랜드)")


if __name__ == "__main__":
    asyncio.run(crawl())
