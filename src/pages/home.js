const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
const NORMALIZE  = { 'ㄲ':'ㄱ', 'ㄸ':'ㄷ', 'ㅃ':'ㅂ', 'ㅆ':'ㅅ', 'ㅉ':'ㅈ' }
const SECTION_ORDER = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']

function getInitial(name) {
  const code = name.charCodeAt(0)
  if (code >= 0xAC00 && code <= 0xD7A3) {
    const cho = CHOSEONG[Math.floor((code - 0xAC00) / 28 / 21)]
    return NORMALIZE[cho] || cho
  }
  const upper = name[0].toUpperCase()
  if (upper >= 'A' && upper <= 'Z') return upper
  return '#'
}

function formatDate(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d)) return iso.slice(0, 10)
  return `${d.getMonth() + 1}/${d.getDate()} 업데이트`
}

function skeletonCards() {
  return `<div class="brand-grid">${Array.from({ length: 6 }, () => `
    <div class="brand-card-skeleton">
      <div class="brand-card-skeleton__preview skeleton"></div>
      <div class="brand-card-skeleton__line skeleton"></div>
      <div class="brand-card-skeleton__line--short skeleton"></div>
    </div>`).join("")}</div>`
}

function brandCardHTML(brand) {
  const previews = brand.preview_thumbnails || []
  let previewHTML
  if (previews.length >= 3) {
    previewHTML = `
      <div class="brand-card__mosaic">
        <div class="brand-card__mosaic-main">
          <img src="${previews[0]}" alt="" loading="lazy" onerror="this.parentElement.style.background='#ede8e2'">
        </div>
        <div class="brand-card__mosaic-side">
          <div class="brand-card__mosaic-cell">
            <img src="${previews[1]}" alt="" loading="lazy" onerror="this.parentElement.style.background='#ede8e2'">
          </div>
          <div class="brand-card__mosaic-cell">
            <img src="${previews[2]}" alt="" loading="lazy" onerror="this.parentElement.style.background='#ede8e2'">
          </div>
        </div>
      </div>`
  } else if (previews.length > 0) {
    previewHTML = `
      <div class="brand-card__thumbs">
        ${previews.map(url => `
          <div class="brand-card__thumb-cell">
            <img src="${url}" alt="" loading="lazy" onerror="this.parentElement.style.background='#ede8e2'">
          </div>`).join("")}
      </div>`
  } else {
    previewHTML = `<div class="brand-card__no-preview"></div>`
  }
  return `
    <div class="brand-card" data-brand="${encodeURIComponent(brand.id)}" role="button" tabindex="0">
      ${previewHTML}
      <div class="brand-card__info">
        <div class="brand-card__name">${brand.name}</div>
        <div class="brand-card__meta">
          <span class="brand-card__count">${brand.total}개</span>
          <span class="brand-card__date">${formatDate(brand.latest_mfg_date)}</span>
        </div>
      </div>
    </div>`
}

export async function renderHome(app) {
  app.innerHTML = `
    <div class="home-header">
      <div class="home-header__logo">마이슈슈</div>
    </div>
    <div class="page page--indexed" id="brand-list">
      ${skeletonCards()}
    </div>
    <div class="scroll-index" id="scroll-index"></div>`

  let brands
  try {
    const res = await fetch("data/brands.json")
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    brands = await res.json()
  } catch (e) {
    document.getElementById("brand-list").innerHTML =
      `<div class="state-error">데이터를 불러오지 못했습니다.</div>`
    return
  }

  if (!brands.length) {
    document.getElementById("brand-list").innerHTML =
      `<div class="state-empty">브랜드 정보가 없습니다.</div>`
    return
  }

  const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name, "ko"))

  // 초성별 그룹핑
  const groups = new Map()
  for (const brand of sorted) {
    const key = getInitial(brand.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(brand)
  }
  const sections = SECTION_ORDER.filter(s => groups.has(s))

  const list    = document.getElementById("brand-list")
  const indexEl = document.getElementById("scroll-index")

  // 섹션 렌더링
  list.innerHTML = sections.map(s => `
    <section class="brand-section" data-section="${s}">
      <div class="brand-section__header">${s}</div>
      <div class="brand-grid">
        ${groups.get(s).map(brandCardHTML).join("")}
      </div>
    </section>`).join("")

  // 인덱스 렌더링
  indexEl.innerHTML = sections.map(s =>
    `<span class="scroll-index__item" data-section="${s}">${s}</span>`
  ).join("")

  // 인덱스를 #app 오른쪽 엣지 기준으로 위치 조정 (스크롤바 겹침 방지)
  function positionIndex() {
    if (!indexEl.isConnected) { window.removeEventListener("resize", positionIndex); return }
    const appRight = document.getElementById("app").getBoundingClientRect().right
    indexEl.style.right = Math.max(4, window.innerWidth - appRight + 4) + "px"
  }
  positionIndex()
  window.addEventListener("resize", positionIndex, { passive: true })

  // 스크롤 시 현재 섹션 하이라이트
  function updateActive() {
    if (!list.isConnected) {
      window.removeEventListener("scroll", updateActive)
      return
    }
    let active = null
    for (const sec of list.querySelectorAll(".brand-section")) {
      if (sec.getBoundingClientRect().top <= 56) active = sec.dataset.section
    }
    indexEl.querySelectorAll(".scroll-index__item").forEach(el =>
      el.classList.toggle("scroll-index__item--active", el.dataset.section === active)
    )
  }
  window.addEventListener("scroll", updateActive, { passive: true })
  updateActive()

  // 플로팅 버블 (드래그 중 현재 글자 표시)
  const bubble = document.createElement("div")
  bubble.className = "scroll-index__bubble"
  document.getElementById("app").appendChild(bubble)

  let bubbleTimer = null
  let dragSection = null

  function showBubble(text) {
    clearTimeout(bubbleTimer)
    bubble.textContent = text
    bubble.classList.add("scroll-index__bubble--visible")
  }
  function hideBubble() {
    bubbleTimer = setTimeout(() => bubble.classList.remove("scroll-index__bubble--visible"), 120)
  }

  // 인덱스 클릭
  function scrollToSection(key, instant = false) {
    const target = list.querySelector(`[data-section="${key}"]`)
    if (!target) return
    const top = target.getBoundingClientRect().top + window.scrollY - 8
    window.scrollTo({ top, behavior: instant ? "instant" : "smooth" })
  }

  indexEl.addEventListener("click", e => {
    const item = e.target.closest(".scroll-index__item")
    if (item) scrollToSection(item.dataset.section)
  })

  // 모바일: 드래그
  indexEl.addEventListener("touchstart", e => {
    const item = e.target.closest(".scroll-index__item")
    if (!item) return
    dragSection = item.dataset.section
    showBubble(dragSection)
  }, { passive: true })

  indexEl.addEventListener("touchmove", e => {
    e.preventDefault()
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const item = el?.closest(".scroll-index__item")
    if (!item) return
    const key = item.dataset.section
    if (key === dragSection) return
    dragSection = key
    showBubble(key)
    navigator.vibrate?.(6)
    scrollToSection(key, true)
  }, { passive: false })

  indexEl.addEventListener("touchend", () => {
    dragSection = null
    hideBubble()
  })

  // 브랜드 카드 클릭
  list.addEventListener("click", e => {
    const card = e.target.closest(".brand-card")
    if (!card) return
    location.hash = `#/brand/${card.dataset.brand}`
  })

  list.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest(".brand-card")
      if (!card) return
      location.hash = `#/brand/${card.dataset.brand}`
    }
  })
}
