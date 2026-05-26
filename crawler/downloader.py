"""이미지 다운로드 (httpx async)"""
import asyncio
import os
import random

import httpx


_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://i54.co.kr/",
}


def _i54_cdn_fallback(url: str) -> str | None:
    """mamacool.diskn.com URL을 i54 CDN URL로 변환."""
    if "mamacool.diskn.com/" in url:
        path = url.split("mamacool.diskn.com/", 1)[1]
        return f"https://i54.co.kr/web/product/big/{path}"
    return None


async def _download_one(client: httpx.AsyncClient, url: str, dest: str) -> bool:
    if os.path.exists(dest):
        return True
    urls = [url]
    fallback = _i54_cdn_fallback(url)
    if fallback:
        urls.append(fallback)
    for attempt in urls:
        try:
            r = await client.get(attempt, headers=_HEADERS, timeout=15, follow_redirects=True)
            r.raise_for_status()
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as f:
                f.write(r.content)
            return True
        except Exception as e:
            if attempt == urls[-1]:
                print(f"    [FAIL] {url} → {str(e).splitlines()[0]}")
    return False


async def download_all(products: list, delay: tuple = (0.3, 0.5)) -> None:
    async with httpx.AsyncClient() as client:
        total_thumb = 0
        total_detail = 0
        fail_thumb = 0
        fail_detail = 0

        for product in products:
            if product.get("thumbnail_url") and product.get("thumbnail_local"):
                ok = await _download_one(client, product["thumbnail_url"], product["thumbnail_local"])
                if ok:
                    total_thumb += 1
                else:
                    product["thumbnail_local"] = None
                    fail_thumb += 1
                await asyncio.sleep(random.uniform(*delay))

            for img in product.get("detail_images", []):
                if not img.get("url") or not img.get("local"):
                    continue
                ok = await _download_one(client, img["url"], img["local"])
                if ok:
                    total_detail += 1
                else:
                    img["local"] = None
                    fail_detail += 1
                await asyncio.sleep(random.uniform(*delay))

        print(
            f"\n이미지 다운로드 완료 — "
            f"썸네일 {total_thumb}개 ({fail_thumb}개 실패), "
            f"상세 {total_detail}개 ({fail_detail}개 실패)"
        )
