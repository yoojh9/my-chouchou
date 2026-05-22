function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return iso.slice(0, 10)
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}/${day} 업데이트`
}

function skeletonCards() {
  return Array.from({ length: 6 }, () => `
    <div class="brand-card-skeleton">
      <div class="brand-card-skeleton__preview skeleton"></div>
      <div class="brand-card-skeleton__line skeleton"></div>
      <div class="brand-card-skeleton__line--short skeleton"></div>
    </div>
  `).join('')
}

function brandCardHTML(brand) {
  const previews = brand.preview_thumbnails || []
  const previewImgs = Array.from({ length: 3 }, (_, i) => {
    const url = previews[i]
    if (url) {
      return `<img class="brand-card__preview-img" src="${url}" alt="" loading="lazy" onerror="this.style.display='none'">`
    }
    return `<div class="brand-card__preview-placeholder"></div>`
  }).join('')

  return `
    <div class="brand-card" data-brand="${encodeURIComponent(brand.id)}" role="button" tabindex="0">
      <div class="brand-card__previews">${previewImgs}</div>
      <div class="brand-card__info">
        <div class="brand-card__name">${brand.name}</div>
        <div class="brand-card__meta">
          <span class="brand-card__count">${brand.total}개 상품</span>
          <span>${formatDate(brand.crawled_at)}</span>
        </div>
      </div>
    </div>
  `
}

export async function renderHome(app) {
  app.innerHTML = `
    <div class="header">
      <span class="header__title">아동복 도매 카탈로그</span>
    </div>
    <div class="page">
      <div class="brand-grid" id="brand-grid">
        ${skeletonCards()}
      </div>
    </div>
  `

  let brands
  try {
    const res = await fetch('data/brands.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    brands = await res.json()
  } catch (e) {
    document.getElementById('brand-grid').innerHTML =
      `<div class="state-error" style="grid-column:1/-1">데이터를 불러오지 못했습니다.</div>`
    return
  }

  if (!brands.length) {
    document.getElementById('brand-grid').innerHTML =
      `<div class="state-empty" style="grid-column:1/-1">브랜드 정보가 없습니다.</div>`
    return
  }

  const grid = document.getElementById('brand-grid')
  grid.innerHTML = brands.map(brandCardHTML).join('')

  grid.addEventListener('click', e => {
    const card = e.target.closest('.brand-card')
    if (!card) return
    const brandId = card.dataset.brand
    location.hash = `#/brand/${brandId}`
  })

  grid.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.brand-card')
      if (!card) return
      const brandId = card.dataset.brand
      location.hash = `#/brand/${brandId}`
    }
  })
}
