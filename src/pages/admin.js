const BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`

const CONCURRENCY = 24
const RENDER_CAP = 80

async function loadAllProducts(onProgress) {
  const brandsRes = await fetch('data/brands.json')
  if (!brandsRes.ok) throw new Error(`brands.json HTTP ${brandsRes.status}`)
  const brands = await brandsRes.json()

  const index = []
  let done = 0

  for (let i = 0; i < brands.length; i += CONCURRENCY) {
    const chunk = brands.slice(i, i + CONCURRENCY)
    await Promise.all(chunk.map(async (b) => {
      try {
        const res = await fetch(`data/i54/brands/${encodeURIComponent(b.id)}.json`)
        if (!res.ok) return
        const products = await res.json()
        products.forEach((p) => {
          const rawName = p.name || ''
          const displayName = rawName.includes('.') ? rawName.split('.').slice(1).join('.') : rawName
          index.push({
            id: String(p.id),
            brand: b.id,
            name: displayName,
            search: `${b.id} ${displayName} ${p.id}`.toLowerCase(),
            thumb: p.thumbnail_url || '',
          })
        })
      } catch (_) { /* 개별 브랜드 실패는 무시 */ }
      done++
      onProgress(done, brands.length)
    }))
  }

  return index
}

export async function renderAdmin(app) {
  app.innerHTML = `
    <div class="header">
      <button class="header__logo" aria-label="홈으로">마이슈슈</button>
      <div class="header__nav">
        <button class="header__back" id="back-btn" aria-label="뒤로가기">
          ${BACK_SVG}홈
        </button>
        <span class="header__title">품절 관리</span>
      </div>
    </div>
    <div class="page admin">
      <div class="admin__loading" id="admin-loading">상품 목록 불러오는 중… (0%)</div>
    </div>`

  document.getElementById('back-btn').addEventListener('click', () => { location.hash = '#/' })

  const page = app.querySelector('.admin')
  const loading = document.getElementById('admin-loading')

  let allProducts, soldoutArr
  try {
    const [products, soldoutRes] = await Promise.all([
      loadAllProducts((d, t) => {
        loading.textContent = `상품 목록 불러오는 중… (${Math.round((d / t) * 100)}%)`
      }),
      fetch('data/soldout.json'),
    ])
    allProducts = products
    soldoutArr = soldoutRes.ok ? await soldoutRes.json() : []
  } catch (e) {
    loading.textContent = '데이터를 불러오지 못했습니다.'
    return
  }

  const soldout = new Set(soldoutArr.map(String))

  page.innerHTML = `
    <div class="admin__toolbar">
      <input class="admin__search" id="admin-search" type="search"
        placeholder="브랜드·상품명·ID로 검색" autocomplete="off">
      <label class="admin__filter">
        <input type="checkbox" id="admin-only-soldout"> 품절만 보기
      </label>
    </div>
    <div class="admin__list" id="admin-list"></div>
    <div class="admin__bar" id="admin-bar">
      <span class="admin__count" id="admin-count"></span>
      <div class="admin__actions">
        <button class="admin__btn" id="admin-copy">soldout.json 복사</button>
        <button class="admin__btn admin__btn--primary" id="admin-download">다운로드</button>
      </div>
    </div>`

  const listEl = document.getElementById('admin-list')
  const searchEl = document.getElementById('admin-search')
  const onlySoldoutEl = document.getElementById('admin-only-soldout')
  const countEl = document.getElementById('admin-count')

  function outputJSON() {
    const arr = [...soldout].sort()
    return JSON.stringify(arr, null, 2)
  }

  function rowHTML(p) {
    const on = soldout.has(p.id)
    return `
      <div class="admin-row${on ? ' is-soldout' : ''}" data-id="${p.id}">
        <div class="admin-row__thumb-wrap">
          ${p.thumb ? `<img class="admin-row__thumb" src="${p.thumb}" alt="" loading="lazy" onerror="this.style.opacity=0">` : ''}
        </div>
        <div class="admin-row__info">
          <div class="admin-row__name">${p.name}</div>
          <div class="admin-row__meta">${p.brand} · ${p.id}</div>
        </div>
        <button class="admin-row__toggle${on ? ' is-on' : ''}" data-id="${p.id}" role="switch" aria-checked="${on}">
          <span class="admin-row__toggle-label">${on ? '품절' : '판매중'}</span>
        </button>
      </div>`
  }

  function currentFilter() {
    const q = searchEl.value.trim().toLowerCase()
    const onlySoldout = onlySoldoutEl.checked
    let list = allProducts
    if (onlySoldout) list = list.filter((p) => soldout.has(p.id))
    if (q) list = list.filter((p) => p.search.includes(q))
    // 품절 상품을 위로
    return list.slice().sort((a, b) => (soldout.has(b.id) ? 1 : 0) - (soldout.has(a.id) ? 1 : 0))
  }

  function renderList() {
    const list = currentFilter()
    if (!list.length) {
      listEl.innerHTML = `<div class="state-empty">해당하는 상품이 없습니다.</div>`
      return
    }
    const shown = list.slice(0, RENDER_CAP)
    let html = shown.map(rowHTML).join('')
    if (list.length > RENDER_CAP) {
      html += `<div class="admin__more">외 ${list.length - RENDER_CAP}개 — 검색으로 좁혀주세요</div>`
    }
    listEl.innerHTML = html
  }

  function updateCount() {
    countEl.textContent = `품절 ${soldout.size}개`
  }

  function toggle(id) {
    if (soldout.has(id)) soldout.delete(id)
    else soldout.add(id)
    const on = soldout.has(id)
    // 같은 id를 가진 상품이 여러 개일 수 있으므로 해당 행을 모두 갱신
    listEl.querySelectorAll(`.admin-row[data-id="${id}"]`).forEach((row) => {
      row.classList.toggle('is-soldout', on)
    })
    listEl.querySelectorAll(`.admin-row__toggle[data-id="${id}"]`).forEach((btn) => {
      btn.classList.toggle('is-on', on)
      btn.setAttribute('aria-checked', String(on))
      btn.querySelector('.admin-row__toggle-label').textContent = on ? '품절' : '판매중'
    })
    updateCount()
  }

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.admin-row__toggle')
    if (!btn) return
    toggle(btn.dataset.id)
  })

  let searchTimer
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(renderList, 150)
  })
  onlySoldoutEl.addEventListener('change', renderList)

  document.getElementById('admin-copy').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(outputJSON())
      flash(e.target, '복사됨 ✓')
    } catch (_) {
      flash(e.target, '복사 실패')
    }
  })

  document.getElementById('admin-download').addEventListener('click', () => {
    const blob = new Blob([outputJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'soldout.json'
    a.click()
    URL.revokeObjectURL(url)
  })

  function flash(btn, text) {
    const orig = btn.textContent
    btn.textContent = text
    btn.disabled = true
    setTimeout(() => { btn.textContent = orig; btn.disabled = false }, 1200)
  }

  updateCount()
  renderList()
}
