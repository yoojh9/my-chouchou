// 해시 URL(#/...)은 그대로 유지해 GitHub Pages 딥링크/새로고침을 안전하게 두면서,
// history.pushState로 '진짜' 히스토리 엔트리를 만들어 카카오톡/모바일 웹뷰의
// 스와이프·하드웨어 뒤로가기가 웹뷰를 닫지 않고 앱 안에서 뒤로 가도록 한다.
//
// 사용법:
//   setRouteHandler((oldHash, newHash) => { ... 렌더 ... })
//   window.addEventListener('load', startRouter)
//   navigate('#/brand/xxx')  // 앞으로 이동
//   goBack('#/')             // 뒤로 (앱 히스토리 없으면 fallback으로)

let currentHash = location.hash || '#/'
let routeHandler = () => {}

// 각 히스토리 엔트리에 앱 내 깊이를 심어, 지금 뒤로 갈 앱 화면이 있는지 판단한다.
function depthOf(state) {
  return state && typeof state.depth === 'number' ? state.depth : 0
}

export function getCurrentHash() {
  return currentHash
}

export function setRouteHandler(fn) {
  routeHandler = fn
}

// 앞으로 이동 — 새 히스토리 엔트리 생성 후 렌더 트리거
export function navigate(hash) {
  if (hash === currentHash) return
  const oldHash = currentHash
  currentHash = hash
  history.pushState({ hash, depth: depthOf(history.state) + 1 }, '', hash)
  routeHandler(oldHash, hash)
}

// 현재 엔트리 대체 — 히스토리를 늘리지 않는 조용한 URL 교체 (렌더는 호출부에서 직접)
export function replaceHash(hash) {
  currentHash = hash
  history.replaceState({ hash, depth: depthOf(history.state) }, '', hash)
}

// 뒤로가기 — 앱 히스토리가 있으면 실제로 뒤로(popstate가 처리),
// 없으면(딥링크로 바로 진입한 경우 등) fallback 화면으로 이동
export function goBack(fallbackHash) {
  if (depthOf(history.state) > 0) {
    history.back()
  } else if (fallbackHash) {
    navigate(fallbackHash)
  }
}

// 스와이프/하드웨어/브라우저 뒤로가기·앞으로가기
window.addEventListener('popstate', () => {
  const oldHash = currentHash
  const newHash = location.hash || '#/'
  if (newHash === oldHash) return
  currentHash = newHash
  routeHandler(oldHash, newHash)
})

// 최초 진입 시 1회 호출 — 자동 스크롤 복원을 끄고, 베이스 엔트리에 depth 0을 심고 첫 렌더
export function startRouter() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  currentHash = location.hash || '#/'
  history.replaceState({ hash: currentHash, depth: 0 }, '', location.href)
  routeHandler(null, currentHash)
}
