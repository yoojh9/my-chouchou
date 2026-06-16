import { productCardHTML } from './productCard.js'

const BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`

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

let sortMode = 'alpha'
let searchQuery = ''

export function resetHomeState() {
  sortMode = 'alpha'
  searchQuery = ''
}

let searchIndexPromise = null
function loadSearchIndex() {
  if (!searchIndexPromise) {
    searchIndexPromise = fetch('data/search_index.json').then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
  }
  return searchIndexPromise
}

let soldoutPromise = null
function loadSoldout() {
  if (!soldoutPromise) {
    soldoutPromise = fetch('data/soldout.json')
      .then(res => res.ok ? res.json() : [])
      .then(arr => new Set(arr.map(String)))
      .catch(() => new Set())
  }
  return soldoutPromise
}

function searchProducts(items, query) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  return items
    .filter(item => {
      const haystack = `${item.brand} ${item.name}`.toLowerCase()
      return tokens.every(t => haystack.includes(t))
    })
    .sort((a, b) => (b.mfg_date || '').localeCompare(a.mfg_date || ''))
}

export async function renderHome(app) {
  app.innerHTML = `
    <div class="home-header">
      <div class="home-header__logo">마이슈슈</div>
      <div class="home-controls">
        <button class="home-search-btn" id="search-btn" aria-label="검색">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <div class="home-search${searchQuery ? ' home-search--expanded' : ' home-search--hidden'}" id="home-search-wrap">
          <input class="home-search__input" id="search-input" type="search" placeholder="브랜드명 또는 상품명 검색" autocomplete="off">
          <button class="home-search__clear${searchQuery ? '' : ' home-search__clear--hidden'}" id="search-clear" aria-label="검색어 지우기">✕</button>
        </div>
        <div class="sort-toggle" id="sort-toggle">
          <button class="sort-toggle__btn${sortMode === 'alpha' ? ' sort-toggle__btn--active' : ''}" data-sort="alpha">ㄱㄴㄷ</button>
          <button class="sort-toggle__btn${sortMode === 'date' ? ' sort-toggle__btn--active' : ''}" data-sort="date">최신순</button>
        </div>
      </div>
    </div>
    <div id="search-nav"></div>
    <div class="page" id="brand-list">
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

  const list        = document.getElementById("brand-list")
  const indexEl     = document.getElementById("scroll-index")
  const toggleEl    = document.getElementById("sort-toggle")
  const searchNavEl = document.getElementById("search-nav")

  function renderAlpha() {
    const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name, "ko"))
    const groups = new Map()
    for (const brand of sorted) {
      const key = getInitial(brand.name)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(brand)
    }
    const sections = SECTION_ORDER.filter(s => groups.has(s))

    list.classList.add("page--indexed")
    list.innerHTML = sections.map(s => `
      <section class="brand-section" data-section="${s}">
        <div class="brand-section__header">${s}</div>
        <div class="brand-grid">
          ${groups.get(s).map(brandCardHTML).join("")}
        </div>
      </section>`).join("")

    indexEl.innerHTML = sections.map(s =>
      `<span class="scroll-index__item" data-section="${s}">${s}</span>`
    ).join("")
    indexEl.style.display = ""
    positionIndex()
  }

  function renderDate() {
    const sorted = [...brands].sort((a, b) => {
      const da = a.latest_mfg_date ? new Date(a.latest_mfg_date) : new Date(0)
      const db = b.latest_mfg_date ? new Date(b.latest_mfg_date) : new Date(0)
      return db - da
    })

    list.classList.remove("page--indexed")
    list.innerHTML = `<div class="brand-grid">${sorted.map(brandCardHTML).join("")}</div>`
    indexEl.innerHTML = ""
    indexEl.style.display = "none"
  }

  function renderList() {
    if (sortMode === 'alpha') renderAlpha()
    else renderDate()
  }

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
    if (sortMode !== 'alpha') return
    let active = null
    for (const sec of list.querySelectorAll(".brand-section")) {
      if (sec.getBoundingClientRect().top <= 56) active = sec.dataset.section
    }
    indexEl.querySelectorAll(".scroll-index__item").forEach(el =>
      el.classList.toggle("scroll-index__item--active", el.dataset.section === active)
    )
  }
  window.addEventListener("scroll", updateActive, { passive: true })

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

  // 정렬 토글
  toggleEl.addEventListener("click", e => {
    const btn = e.target.closest(".sort-toggle__btn")
    if (!btn) return
    const mode = btn.dataset.sort
    if (mode === sortMode) return
    sortMode = mode
    toggleEl.querySelectorAll(".sort-toggle__btn").forEach(b =>
      b.classList.toggle("sort-toggle__btn--active", b.dataset.sort === mode)
    )
    window.scrollTo({ top: 0, behavior: "instant" })
    renderList()
    updateActive()
  })

  // 검색
  const searchInput = document.getElementById("search-input")
  const searchClear = document.getElementById("search-clear")
  const searchBtn   = document.getElementById("search-btn")
  const searchWrap  = document.getElementById("home-search-wrap")
  let searchDebounce = null

  function openSearch() {
    searchWrap.classList.remove("home-search--hidden")
    searchWrap.classList.add("home-search--expanded")
    toggleEl.style.display = "none"
    searchInput.focus()
  }

  function closeSearch() {
    searchWrap.classList.add("home-search--hidden")
    searchWrap.classList.remove("home-search--expanded")
    toggleEl.style.display = ""
  }

  searchBtn.addEventListener("click", () => {
    if (searchQuery) return
    if (searchWrap.classList.contains("home-search--hidden")) {
      openSearch()
    } else {
      closeSearch()
    }
  })

  searchInput.value = searchQuery

  function searchResultsHeaderHTML() {
    return `
      <div class="header search-results__header">
        <button class="header__back" id="search-back-btn" aria-label="뒤로가기">
          ${BACK_SVG}홈
        </button>
        <span class="header__title">검색결과</span>
      </div>`
  }

  function exitSearch() {
    searchInput.value = ""
    closeSearch()
    runSearch("")
    window.scrollTo({ top: 0, behavior: "instant" })
  }

  async function runSearch(query) {
    searchQuery = query
    searchClear.classList.toggle("home-search__clear--hidden", !query)

    if (!query.trim()) {
      if (searchWrap.classList.contains("home-search--hidden")) {
        toggleEl.style.display = ""
      }
      searchNavEl.innerHTML = ""
      list.classList.remove("page--search")
      renderList()
      updateActive()
      return
    }

    toggleEl.style.display = "none"
    indexEl.style.display = "none"
    list.classList.remove("page--indexed")
    list.classList.add("page--search")
    searchNavEl.innerHTML = searchResultsHeaderHTML()
    searchNavEl.style.top = document.querySelector('.home-header').offsetHeight + 'px'
    list.innerHTML = `<div class="state-empty">검색 중...</div>`

    let items, soldoutIds
    try {
      [items, soldoutIds] = await Promise.all([loadSearchIndex(), loadSoldout()])
    } catch (e) {
      list.innerHTML = `<div class="state-error">검색 데이터를 불러오지 못했습니다.</div>`
      return
    }

    if (searchInput.value !== query) return

    const results = searchProducts(items, query)
    if (!results.length) {
      list.innerHTML = `<div class="state-empty">검색 결과가 없습니다.</div>`
      return
    }
    list.innerHTML = `<div class="product-grid">${results.map(p => productCardHTML(p, p.brand, soldoutIds)).join("")}</div>`
  }

  searchInput.addEventListener("input", e => {
    const value = e.target.value
    searchClear.classList.toggle("home-search__clear--hidden", !value)
    clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => runSearch(value), 200)
  })

  searchClear.addEventListener("click", () => {
    searchInput.value = ""
    closeSearch()
    runSearch("")
  })

  if (searchQuery.trim()) {
    await runSearch(searchQuery)
  } else {
    renderList()
    updateActive()
  }

  searchNavEl.addEventListener("click", e => {
    if (e.target.closest("#search-back-btn")) exitSearch()
  })

  // 브랜드 카드 / 검색 결과 클릭
  list.addEventListener("click", e => {
    const product = e.target.closest("[data-href]")
    if (product) { location.hash = product.dataset.href; return }
    const card = e.target.closest(".brand-card")
    if (!card) return
    location.hash = `#/brand/${card.dataset.brand}`
  })

  list.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      const product = e.target.closest("[data-href]")
      if (product) { location.hash = product.dataset.href; return }
      const card = e.target.closest(".brand-card")
      if (!card) return
      location.hash = `#/brand/${card.dataset.brand}`
    }
  })
}
