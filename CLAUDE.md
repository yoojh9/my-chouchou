# my-chouchou

## 구조

- `src/main.js` — 해시 라우터 (`#/`, `#/brand/:id`, `#/product/:bid/:pid`, `#/cart`) + 플로팅 장바구니 버튼
- `src/cart.js` — localStorage 기반 장바구니 상태 관리
- `src/pages/home.js` — 브랜드 그리드 (`data/brands.json`)
- `src/pages/brand.js` — 브랜드별 상품 목록, 20개씩 페이지네이션
- `src/pages/product.js` — 상품 상세 + 색상·사이즈·수량 선택 + 장바구니 담기
- `src/pages/cart.js` — 장바구니 페이지 + 구글 폼 주문서 연동
- `public/data/` — 정적 JSON 데이터 (`convert_excel.py`로 갱신)

## 데이터 파일

| 파일 | 역할 |
|------|------|
| `data/brands.json` | 브랜드 목록 + 미리보기 썸네일 (홈화면) |
| `data/i54/brands/{브랜드명}.json` | 브랜드별 전체 상품 |
| `data/items/2026-05.xlsx` | 원본 엑셀 — `convert_excel.py`로 JSON 변환 |
| `data/soldout.json` | 품절 상품 ID 배열 — 직접 편집 |

## 상품 JSON 구조

```json
{
  "id": "26050001",
  "brand": "브랜드명",
  "name": "브랜드명.상품명",
  "price_sale": 12800,
  "thumbnail_url": "https://...",
  "detail_images": ["https://...", "https://..."],
  "colors": [
    { "name": "레드", "add_price": 0 },
    { "name": "네이비", "add_price": 0 }
  ],
  "sizes": [
    { "name": "S", "add_price": 0 },
    { "name": "XL", "add_price": 1000 }
  ]
}
```

엑셀 → JSON 변환: `python3 convert_excel.py` (프로젝트 루트에서 실행)

## 장바구니

장바구니는 `localStorage`(`mychouchou_cart`)에 저장되며 앱을 닫아도 유지된다.

**카트 아이템 구조:**
```js
{
  id: String,           // 상품 ID
  brand: String,        // 브랜드명
  name: String,         // 상품명 (브랜드 포함, e.g. "스튜디오엠 후리지아원피스")
  selectedColor: String, // 선택한 색상
  size: String,         // 선택한 사이즈 (없으면 "FREE")
  addPrice: Number,     // 색상+사이즈 합산 추가금액 (원본값, 표시 시 × 1.6 적용)
  basePrice: Number,    // 기본 판매가 (price_sale)
  quantity: Number,     // 수량
}
```

**가격 계산:** `basePrice + Math.round(addPrice * 1.6)` — 추가금액에 1.6배 마진 적용.
**중복 체크:** `id + size + selectedColor` 세 필드가 모두 같아야 중복으로 처리.

## 구글 폼 주문서 연동

장바구니 페이지 → "주문서 작성하기" 클릭 시 구글 폼을 pre-fill URL로 새 탭에서 열어 준다.

- **폼 URL**: `https://docs.google.com/forms/d/e/1FAIpQLSeZizFGM2RLkzbSWi9j0Utn-QgwbI2DowSWwC9FMoHO4nRGlg/viewform`
- **채워지는 필드**: `entry.212051867` (구매할 상품 목록)
- **형식**: `상품명 / 색상 / 사이즈 / N개` (줄바꿈으로 상품 구분)

사용자가 폼에서 이름·주소·연락처를 직접 입력 후 제출한다.

## 품절 처리

`soldout.json`의 ID 배열을 `brand.js` / `product.js` 양쪽에서 `Promise.all`로 병렬 로드. `Set`으로 변환해 O(1) 조회. 카드에는 `.soldout-badge` 오버레이, 상세에는 `.soldout-label` 표시.

## 사용법

README.md 참고.
