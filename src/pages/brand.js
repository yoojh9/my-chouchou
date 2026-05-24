const PAGE_SIZE = 20
const BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`

function formatPrice(n) {
  return Number(n).toLocaleString('ko-KR') + '원'
}

function stripBrandPrefix(name) {
  const dotIdx = name.indexOf('.')
  return dotIdx !== -1 ? name.slice(dotIdx + 1).trim() : name
}

function skeletonCards() {
  return Array.from({ length: 6 }, () => `
    <div class="product-card-skeleton">
      <div class="product-card-skeleton__thumb skeleton"></div>
      <div class="product-card-skeleton__line skeleton"></div>
      <div class="product-card-skeleton__line--short skeleton"></div>
    </div>`).join('')
}

function productCardHTML(product, brandId, soldoutIds) {
  const thumbUrl = product.thumbnail_url || ''
  const name = stripBrandPrefix(product.name || '상품명 없음')
  const pid = encodeURIComponent(product.id)
  const bid = encodeURIComponent(brandId)
  const isSoldout = soldoutIds.has(String(product.id))

  return `
    <div class="product-card${isSoldout ? ' product-card--soldout' : ''}" data-href="#/product/${bid}/${pid}" role="button" tabindex="0">
      <div class="product-card__thumb-wrap">
        <img class="product-card__thumb"
          src="${thumbUrl}"
          alt="${name}"
          loading="lazy"
          onerror="this.style.opacity='0'"
        >
        ${isSoldout ? '<div class="soldout-badge">품절</div>' : ''}
      </div>
      <div class="product-card__info">
        <div class="product-card__name">${name}</div>
        <div class="product-card__bottom">
          <span class="product-card__price">${formatPrice(product.price_original)}</span>
          ${product.colors ? `<span class="product-card__color">${product.colors}</span>` : ''}
        </div>
      </div>
    </div>`
}

export async function renderBrand(app, brandId) {
  app.innerHTML = `
    <div class="header">
      <button class="header__back" id="back-btn" aria-label="뒤로가기">
        ${BACK_SVG}브랜드
      </button>
      <span class="header__title">${brandId}</span>
    </div>
    <div class="page">
      <div class="product-grid" id="product-grid">
        ${skeletonCards()}
      </div>
      <button class="load-more" id="load-more" style="display:none">더보기</button>
    </div>`

  document.getElementById('back-btn').addEventListener('click', () => {
    location.hash = '#/'
  })

  let products, soldoutIds
  try {
    const [productsRes, soldoutRes] = await Promise.all([
      fetch(`data/i54/brands/${encodeURIComponent(brandId)}.json`),
      fetch('data/soldout.json'),
    ])
    if (!productsRes.ok) throw new Error(`HTTP ${productsRes.status}`)
    products = await productsRes.json()
    soldoutIds = new Set((soldoutRes.ok ? await soldoutRes.json() : []).map(String))
  } catch (e) {
    document.getElementById('product-grid').innerHTML =
      `<div class="state-error" style="grid-column:1/-1">데이터를 불러오지 못했습니다.</div>`
    return
  }

  products = products.sort((a, b) => (b.mfg_date || '').localeCompare(a.mfg_date || ''))

  const grid = document.getElementById('product-grid')
  const loadMoreBtn = document.getElementById('load-more')

  if (!products.length) {
    grid.innerHTML = `<div class="state-empty" style="grid-column:1/-1">상품이 없습니다.</div>`
    return
  }

  let shown = 0

  function renderMore() {
    const batch = products.slice(shown, shown + PAGE_SIZE)
    batch.forEach(p => {
      grid.insertAdjacentHTML('beforeend', productCardHTML(p, brandId, soldoutIds))
    })
    shown += batch.length
    loadMoreBtn.style.display = shown < products.length ? 'block' : 'none'
  }

  grid.innerHTML = ''
  renderMore()

  loadMoreBtn.addEventListener('click', renderMore)

  grid.addEventListener('click', e => {
    const card = e.target.closest('[data-href]')
    if (!card) return
    location.hash = card.dataset.href
  })

  grid.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('[data-href]')
      if (!card) return
      location.hash = card.dataset.href
    }
  })
}
