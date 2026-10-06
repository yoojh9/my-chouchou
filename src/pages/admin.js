const BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`

const CONCURRENCY = 24
const RENDER_CAP = 80

function shellQuote(s) {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

// 품절: 토글 결과를 soldout.json(상품 ID 배열)으로 내보낸다.
// 세일: 고른 상품을 (세일) 상품으로 바꾸는 convert_excel.py 명령어를 내보낸다.
//       정적 사이트라 데이터 파일을 직접 고칠 수 없어, 명령어를 터미널에서 실행해야 반영된다.
const MODES = {
  soldout: {
    tab: '품절',
    onLabel: '품절',
    offLabel: '판매중',
    onlyLabel: '품절만 보기',
    countLabel: '품절',
    copyLabel: 'soldout.json 복사',
    file: 'soldout.json',
    keyOf: (p) => p.id,
    output: (keys) => JSON.stringify(keys, null, 2),
  },
  sale: {
    tab: '세일로 변경',
    onLabel: '선택',
    offLabel: '일반',
    onlyLabel: '선택만 보기',
    countLabel: '선택',
    copyLabel: '명령어 복사',
    keyOf: (p) => p.rawName,
    output: (keys) => `python3 convert_excel.py --sale ${keys.map(shellQuote).join(' ')}`,
  },
}

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
            rawName,
            // 이름에 이미 (세일)이 붙은 상품은 세일로 바꿀 대상이 아니다
            nativeSale: rawName.includes('(세일)'),
            search: `${b.id} ${displayName} ${p.id}`.toLowerCase(),
            thumb: p.thumbnail_url || '',
          })
        })
      } catch (_) { /* 개별 브랜드 실패는 무시 */ }
      done++
      onProgress(done, brands.length)
    }))
  }

  index.forEach((p, i) => { p.idx = i })
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
        <span class="header__title">품절·세일 관리</span>
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

  const sets = {
    soldout: new Set(soldoutArr.map(String)),
    sale: new Set(),
  }
  let mode = 'soldout'

  page.innerHTML = `
    <div class="admin__tabs" id="admin-tabs">
      ${Object.entries(MODES).map(([key, m]) =>
        `<button class="admin__tab${key === mode ? ' is-active' : ''}" data-mode="${key}">${m.tab}</button>`).join('')}
    </div>
    <div class="admin__toolbar">
      <input class="admin__search" id="admin-search" type="search"
        placeholder="브랜드·상품명·ID로 검색" autocomplete="off">
      <label class="admin__filter">
        <input type="checkbox" id="admin-only-on"> <span id="admin-only-label"></span>
      </label>
    </div>
    <div class="admin__list" id="admin-list"></div>
    <div class="admin__bar" id="admin-bar">
      <span class="admin__count" id="admin-count"></span>
      <div class="admin__actions">
        <button class="admin__btn" id="admin-copy"></button>
        <button class="admin__btn admin__btn--primary" id="admin-download">다운로드</button>
      </div>
    </div>`

  const tabsEl = document.getElementById('admin-tabs')
  const listEl = document.getElementById('admin-list')
  const searchEl = document.getElementById('admin-search')
  const onlyOnEl = document.getElementById('admin-only-on')
  const onlyLabelEl = document.getElementById('admin-only-label')
  const countEl = document.getElementById('admin-count')
  const copyEl = document.getElementById('admin-copy')
  const downloadEl = document.getElementById('admin-download')

  function isOn(p) {
    return sets[mode].has(MODES[mode].keyOf(p))
  }

  function isLocked(p) {
    return mode === 'sale' && p.nativeSale
  }

  function output() {
    return MODES[mode].output([...sets[mode]].sort())
  }

  function rowHTML(p) {
    const m = MODES[mode]
    const on = isOn(p)
    const locked = isLocked(p)
    const shownOn = on || locked
    return `
      <div class="admin-row${on ? ' is-on' : ''}" data-idx="${p.idx}">
        <div class="admin-row__thumb-wrap">
          ${p.thumb ? `<img class="admin-row__thumb" src="${p.thumb}" alt="" loading="lazy" onerror="this.style.opacity=0">` : ''}
        </div>
        <div class="admin-row__info">
          <div class="admin-row__name">${p.name}</div>
          <div class="admin-row__meta">${p.brand} · ${p.id}</div>
        </div>
        <button class="admin-row__toggle${shownOn ? ' is-on' : ''}" data-idx="${p.idx}" role="switch" aria-checked="${shownOn}"${locked ? ' disabled' : ''}>
          <span class="admin-row__toggle-label">${locked ? '세일' : on ? m.onLabel : m.offLabel}</span>
        </button>
      </div>`
  }

  function currentFilter() {
    const q = searchEl.value.trim().toLowerCase()
    let list = allProducts
    if (onlyOnEl.checked) list = list.filter(isOn)
    if (q) list = list.filter((p) => p.search.includes(q))
    // 지정된 상품을 위로
    return list.slice().sort((a, b) => (isOn(b) ? 1 : 0) - (isOn(a) ? 1 : 0))
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
    countEl.textContent = `${MODES[mode].countLabel} ${sets[mode].size}개`
  }

  function toggle(p) {
    const m = MODES[mode]
    const key = m.keyOf(p)
    const set = sets[mode]
    if (set.has(key)) set.delete(key)
    else set.add(key)
    const on = set.has(key)
    // 같은 id·name을 가진 상품이 여러 개일 수 있으므로 해당 행을 모두 갱신
    listEl.querySelectorAll('.admin-row').forEach((row) => {
      if (m.keyOf(allProducts[row.dataset.idx]) !== key) return
      row.classList.toggle('is-on', on)
      const btn = row.querySelector('.admin-row__toggle')
      btn.classList.toggle('is-on', on)
      btn.setAttribute('aria-checked', String(on))
      btn.querySelector('.admin-row__toggle-label').textContent = on ? m.onLabel : m.offLabel
    })
    updateCount()
  }

  function setMode(next) {
    mode = next
    const m = MODES[mode]
    tabsEl.querySelectorAll('.admin__tab').forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.mode === mode)
    })
    onlyLabelEl.textContent = m.onlyLabel
    onlyOnEl.checked = false
    copyEl.textContent = m.copyLabel
    downloadEl.hidden = !m.file
    updateCount()
    renderList()
  }

  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('.admin__tab')
    if (!tab || tab.dataset.mode === mode) return
    setMode(tab.dataset.mode)
  })

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.admin-row__toggle')
    if (!btn || btn.disabled) return
    toggle(allProducts[btn.dataset.idx])
  })

  let searchTimer
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(renderList, 150)
  })
  onlyOnEl.addEventListener('change', renderList)

  copyEl.addEventListener('click', async () => {
    if (mode === 'sale' && !sets.sale.size) {
      flashCopy('선택한 상품 없음')
      return
    }
    try {
      await navigator.clipboard.writeText(output())
      flashCopy('복사됨 ✓')
    } catch (_) {
      flashCopy('복사 실패')
    }
  })

  downloadEl.addEventListener('click', () => {
    const blob = new Blob([output()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = MODES[mode].file
    a.click()
    URL.revokeObjectURL(url)
  })

  function flashCopy(text) {
    copyEl.textContent = text
    copyEl.disabled = true
    // 그 사이 탭이 바뀌었을 수 있으므로 현재 모드의 라벨로 되돌린다
    setTimeout(() => { copyEl.textContent = MODES[mode].copyLabel; copyEl.disabled = false }, 1200)
  }

  setMode(mode)
}
