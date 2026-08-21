// 빌드 시각을 KST(한국시간) 기준 문자열로 주입 — 카톡 웹뷰에서 배포 버전 확인용 표식에 사용
const buildId = new Date(Date.now() + 9 * 60 * 60 * 1000)
  .toISOString()
  .slice(5, 16)
  .replace('T', ' ')

export default {
  base: "/",
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
};
