# my-chouchou

아동복 카탈로그 웹앱. 엑셀로 받은 상품 데이터를 변환해 브랜드별로 탐색하고 장바구니에 담아 주문서를 작성한다.

## 실행

```bash
npm run dev      # 개발 서버 → http://localhost:5173/my-chouchou
npm run build    # dist/ 빌드
npm run preview  # 빌드 결과 미리보기
```

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

### 3. 결과 확인

- `public/data/i54/brands/{브랜드}.json` — 브랜드별 상품 누적
- `public/data/brands.json` — 브랜드 목록 자동 갱신
- **같은 `브랜드.상품명`은 중복 추가되지 않는다.**

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
