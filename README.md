# my-shushu

i54.co.kr 크롤링 데이터를 보여주는 아동복 카탈로그 웹앱.

## 실행

```bash
npm run dev      # 개발 서버 → http://localhost:5173/my-shushu
npm run build    # dist/ 빌드
npm run preview  # 빌드 결과 미리보기
```

## 데이터 업데이트

i54-crawler를 실행하면 `public/data/`가 자동 갱신된다.

```bash
cd ../i54-crawler
python3 crawler.py --no-images
```

dev 서버가 실행 중이라면 **새로고침만 해도 반영**된다.

## 품절 관리

`public/data/soldout.json`에 품절 상품 ID를 직접 추가하면 UI에 즉시 반영된다.

```json
["1234567", "9876543"]
```

상품 ID는 브랜드 JSON 파일(`public/data/i54/brands/{브랜드명}.json`)의 `"id"` 필드 값이다.

- 브랜드 목록 페이지: 썸네일에 **품절** 뱃지 + 이미지 흐리게 표시
- 상품 상세 페이지: 이름 아래 **품절** 라벨 표시

품절이 해제되면 해당 ID를 배열에서 제거하면 된다.
