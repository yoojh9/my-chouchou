# my-chouchou

아동복 카탈로그 웹앱. 엑셀로 받은 상품 데이터를 변환해 브랜드별로 탐색하고 장바구니에 담아 주문서를 작성한다.

## 실행

```bash
npm run dev      # 개발 서버 → http://localhost:5173/my-chouchou
npm run build    # dist/ 빌드
npm run preview  # 빌드 결과 미리보기
```

## i54.co.kr 브랜드 크롤링

i54.co.kr에 로그인해 특정 브랜드의 전체 상품(옵션·이미지 포함)을 가져와 `convert_excel.py` 입력용 엑셀로 저장한다.

```bash
python3 crawl_brand.py <브랜드명>
python3 crawl_brand.py 소예 --since 2026-06-01   # 제조일자 2026-06-01 이후 상품만
```

- 로그인 계정: 프로젝트 루트 `.env`의 `I54_ID` / `I54_PW`
- 검색 결과 중 상품명이 `브랜드명.`으로 시작하는 상품만 수집한다.
- 결과: `data/<브랜드명>_<오늘날짜>.xlsx`
- 가격(`price_sale`)은 **소비자가** 기준, 사이즈/색상 추가금(`add_price`)은 판매가 기준 차이로 계산한다.
- 옵션값에 포함된 `(+3000)` 같은 추가금 표기는 제거한다.
- 상세설명 이미지 중 `washingtip.jpg`, `kc.jpg`는 제외한다.
- 요청 간 1초 딜레이를 둔다 (i54 어뷰징 탐지 차단 방지). 403이 발생하면 브라우저와 동일한 헤더(`HEADERS`)를 보내고 있는지 확인한다.

받은 엑셀은 파일명을 `2026-06-15.xlsx` 형식으로 바꾼 뒤 [엑셀 변환 스크립트](#2-변환-스크립트-실행)로 처리한다.

---

## i54.co.kr 페이지 크롤링 (URL 지정)

브랜드명이 아니라 카테고리/검색결과 같은 특정 목록 페이지 URL을 지정해 그 페이지에 나열된 상품을 그대로 수집한다. 브랜드는 상품명의 `브랜드명.상품명` 표기에서 자동으로 추출한다.

```bash
python3 crawl_page.py "https://i54.co.kr/product/list.html?cate_no=2513&page=1"
python3 crawl_page.py "https://i54.co.kr/product/list.html?cate_no=2513" --start-page 1 --end-page 5
python3 crawl_page.py "https://i54.co.kr/product/list.html?cate_no=2513" --end-page 3 --since 2026-06-01
```

- `--start-page` : 시작 페이지 (생략 시 URL의 `page` 값, 없으면 1)
- `--end-page` : 끝 페이지 (생략 시 `--start-page`와 동일, 즉 한 페이지만 수집)
- `--since YYYY-MM-DD` : 해당 날짜 이후(포함) 제조 상품만 수집
- 상품명에 `.`이 없어 브랜드를 식별할 수 없는 상품은 제외한다.
- 결과: `data/page_crawl_<오늘날짜>.xlsx` (마지막 인자로 출력파일명을 지정하면 `data/<지정한이름>_<오늘날짜>.xlsx`)

```bash
python3 crawl_page.py "https://i54.co.kr/product/list.html?cate_no=2513" --end-page 5 신상카테고리
```

---

## 상품 데이터 업데이트

### 1. 엑셀 파일 추가

새 엑셀 파일을 `data/` 폴더에 넣는다.

```
data/
  2026-05.xlsx
  2026-05-27.xlsx   ← 새 파일
```

### 2. 변환 스크립트 실행

```bash
python3 convert_excel.py data/2026-05-27.xlsx
```

파일 경로를 생략하면 `data/` 폴더의 xlsx 목록을 보여주고 선택할 수 있다.

```bash
python3 convert_excel.py
# → 번호 입력: 2
```

썸네일 다운로드를 생략하려면 `--no-thumbnails`를 추가한다.

```bash
python3 convert_excel.py data/2026-05-27.xlsx --no-thumbnails
```

### 3. 결과 확인

- `public/data/i54/brands/{브랜드}.json` — 브랜드별 상품 누적
- `public/data/brands.json` — 브랜드 목록 자동 갱신
- **같은 `브랜드.상품명`이 이미 있으면 `mfg_date`가 더 최신인 데이터로 교체된다.** (이전 데이터가 더 최신이면 스킵)

dev 서버가 실행 중이라면 **새로고침만 해도 반영**된다.

---

## 상품 데이터 삭제

### 특정 날짜 이하 상품 일괄 삭제

```bash
python3 convert_excel.py --purge 2026-05-21
```

`mfg_date`가 `2026-05-21` **이하**인 상품을 전체 브랜드에서 삭제한다.

### 특정 상품 삭제

```bash
python3 convert_excel.py --delete "러빈.브리즈줄팬츠"
python3 convert_excel.py --delete "러빈.브리즈줄팬츠" "슈크림.소다팝줄티"
```

`브랜드.상품명` 형식으로 지정한다. 여러 개를 한 번에 삭제할 수 있다.  
상품명은 `public/data/i54/brands/{브랜드}.json`의 `"name"` 필드 값이다.

---

## 깨진 이미지 상품 삭제

썸네일 URL에 HTTP 요청을 보내 깨진 상품을 찾아 자동 삭제한다.

```bash
python3 check_broken_thumbnails.py
```

삭제 전에 dry-run으로 먼저 확인할 수 있다.

```bash
python3 check_broken_thumbnails.py --dry-run
```

### 삭제 기준 선택

| 옵션 | 동작 |
|------|------|
| `--mode all` (기본) | 썸네일 + 상세이미지 **전부** 깨진 경우만 삭제 |
| `--mode thumbnail` | 썸네일만 깨져도 바로 삭제 |

```bash
python3 check_broken_thumbnails.py --mode thumbnail
python3 check_broken_thumbnails.py --mode thumbnail --dry-run
```

삭제 시 `brands/{브랜드}.json`, `brands/{브랜드}.full.json`, `brands.json`, `soldout.json`이 모두 함께 갱신된다. 브랜드의 모든 상품이 삭제되면 `brands.json`에서 해당 브랜드도 제거된다.

동시 요청 수는 `--workers`로 조정할 수 있다 (기본 10).

```bash
python3 check_broken_thumbnails.py --workers 20
```

---

## 가격 검증

구글 폼으로 들어온 주문서의 가격이 맞는지 확인할 수 있다.

`order.md`에 구글 폼 내용을 그대로 붙여넣은 뒤 실행한다.

```
# 주문 검증

드레스몬스터 버뮤다카펜터pt / 인디고 / JS / 1개 / 30,400원
마마스파파 도그케잌핀세트 / 도그세트 / 4개1세트 / 2개 / 12,800원
```

```bash
python3 validate_price.py
```

다른 파일을 지정할 수도 있다.

```bash
python3 validate_price.py other.md
```

`#`으로 시작하는 줄과 빈 줄은 무시된다. 색상이 없는 상품도 자동 처리된다. 불일치 시 계산 금액과 차이를 함께 출력한다.

---

## 장바구니 & 주문서 작성

상품 상세에서 색상 → 사이즈 → 수량을 선택한 뒤 **장바구니 담기**.  
오른쪽 하단 플로팅 버튼으로 장바구니로 이동.

장바구니에서 **주문서 작성하기**를 누르면 구글 폼이 상품 목록이 자동 채워진 상태로 열린다.  
이름·주소·연락처를 입력 후 제출하면 된다.

- 장바구니는 브라우저 `localStorage`에 저장되어 앱을 닫아도 유지된다.
- **장바구니 비우기** 버튼으로 수동 초기화할 수 있다.

---

## 품절 관리

`public/data/soldout.json`에 품절 상품 ID를 직접 추가하면 UI에 즉시 반영된다.

```json
["26050042", "26050137"]
```

상품 ID는 `public/data/i54/brands/{브랜드명}.json`의 `"id"` 필드 값이다.  
품절이 해제되면 해당 ID를 배열에서 제거한다.
