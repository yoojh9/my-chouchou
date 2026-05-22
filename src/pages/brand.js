function formatPrice(n) {
  return Number(n).toLocaleString('ko-KR') + '원'
}

function skeletonCards() {
  return Array.from({ length: 12 }, () => `
    <div class="product-card-skeleton">
      <div class="product-card-skeleton__thumb skeleton"></div>
      <div class="product-card-skeleton__line skeleton"></div>
      <div class="product-card-skeleton__line--short skeleton"></div>
    </div>
  `).join('')
}

function productCardHTML(product, brandId) {
  const thumbUrl = product.thumbnail_url || ''
  const name = product.name || '상품명 없음'
  const sale = product.price_sale
  const orig = product.price_original
  const pid = encodeURIComponent(product.id)
  const bid = encodeURIComponent(brandId)

  const originalPriceHTML = orig && orig !== sale
    ? `<span class="product-card__price-original">${formatPrice(orig)}</span>`
    : ''

  return `
    <div class="product-card" data-href="#/product/${bid}/${pid}" role="button" tabindex="0">
      <div class="product-card__thumb-wrap img-placeholder">
        <img class="product-card__thumb"
          src="${thumbUrl}"
          alt="${name}"
          loading="lazy"
          onerror="this.src=''"
        >
      </div>
      <div class="product-card__info">
        <div class="product-card__name">${name}</div>
        <div class="product-card__prices">
          <span class="product-card__price-sale">${formatPrice(sale)}</span>
          ${originalPriceHTML}
        </div>
      </div>
    </div>
  `
}

export async function renderBrand(app, brandId) {
  app.innerHTML = `
    <div class="header">
      <button class="header__back" id="back-btn" aria-label="뒤로가기">←</button>
      <span class="header__title">${brandId}</span>
    </div>
    <div class="page">
      <div class="product-grid" id="product-grid">
        ${skeletonCards()}
      </div>
    </div>
  `

  document.getElementById('back-btn').addEventListener('click', () => {
    location.hash = '#/'
  })

  let products
  try {
    const res = await fetch(`data/joykids/brands/${encodeURIComponent(brandId)}.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    products = await res.json()
  } catch (e) {
    document.getElementById('product-grid').innerHTML =
      `<div class="state-error" style="grid-column:1/-1">데이터를 불러오지 못했습니다.</div>`
    return
  }

  products = products.sort((a, b) => {
      const da = a.mfg_date || ''
      const db = b.mfg_date || ''
      return db.localeCompare(da)
    })

  const grid = document.getElementById('product-grid')

  if (!products.length) {
    grid.innerHTML = `<div class="state-empty" style="grid-column:1/-1">상품이 없습니다.</div>`
    return
  }

  grid.innerHTML = products.map(p => productCardHTML(p, brandId)).join('')

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
