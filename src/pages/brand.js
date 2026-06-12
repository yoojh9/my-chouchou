import { productCardHTML } from './productCard.js'

const PAGE_SIZE = 20
const BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`


function skeletonCards() {
  return Array.from({ length: 6 }, () => `
    <div class="product-card-skeleton">
      <div class="product-card-skeleton__thumb skeleton"></div>
      <div class="product-card-skeleton__line skeleton"></div>
      <div class="product-card-skeleton__line--short skeleton"></div>
    </div>`).join('')
}

function sizeChartCardHTML(urls) {
  const encoded = encodeURIComponent(JSON.stringify(urls))
  const label = urls.length > 1 ? `사이즈표 (${urls.length}장)` : '사이즈표'
  return `
    <div class="product-card size-chart-card" data-size-charts="${encoded}" role="button" tabindex="0">
      <div class="product-card__thumb-wrap">
        <img class="product-card__thumb"
          src="${urls[0]}"
          alt="사이즈표"
          loading="lazy"
          onerror="this.style.opacity='0'"
        >
      </div>
      <div class="product-card__info">
        <div class="product-card__name">${label}</div>
        <div class="product-card__bottom">
          <span class="product-card__price" style="color:#888;font-size:0.8em">클릭하여 크게 보기</span>
        </div>
      </div>
    </div>`
}

function probeImage(url) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(url)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function findSizeChart(brandId) {
  const exts = ['jpg', 'jpeg', 'png', 'webp']
  const norms = [brandId, brandId.normalize('NFD')]

  for (const name of norms) {
    const base = `data/size-charts/${name}`

    for (const ext of exts) {
      const url = await probeImage(`${base}.${ext}`)
      if (url) return [url]
    }

    const results = []
    for (let n = 1; n <= 10; n++) {
      let found = null
      for (const ext of exts) {
        const url = await probeImage(`${base}_${n}.${ext}`)
        if (url) { found = url; break }
      }
      if (!found) break
      results.push(found)
    }
    if (results.length) return results
  }
  return null
}

export async function renderBrand(app, brandId, initialShown = 0) {
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
  const sizeChartPromise = findSizeChart(brandId)

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

  const grid = document.getElementById('product-grid')
  const loadMoreBtn = document.getElementById('load-more')

  if (!products.length) {
    grid.innerHTML = `<div class="state-empty" style="grid-column:1/-1">상품이 없습니다.</div>`
    return
  }

  products = products.slice().reverse()

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
  const pagesToRestore = initialShown > 0 ? Math.ceil(initialShown / PAGE_SIZE) : 1
  for (let i = 0; i < pagesToRestore && shown < products.length; i++) renderMore()

  sizeChartPromise.then(urls => {
    if (urls) grid.insertAdjacentHTML('afterbegin', sizeChartCardHTML(urls))
  })

  loadMoreBtn.addEventListener('click', renderMore)

  function openSizeCharts(card) {
    const urls = JSON.parse(decodeURIComponent(card.dataset.sizeCharts))
    const modal = document.createElement('div')
    modal.className = 'sizechart-modal'
    modal.innerHTML = `
      <button class="sizechart-modal__close" aria-label="닫기">✕</button>
      <div class="sizechart-modal__inner">
        ${urls.map(u => `<img class="sizechart-modal__img" src="${u}" alt="사이즈표">`).join('')}
      </div>`
    document.body.appendChild(modal)
    const close = () => modal.remove()
    modal.querySelector('.sizechart-modal__close').addEventListener('click', close)
    modal.addEventListener('click', e => { if (e.target === modal) close() })
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc) }
    })
  }

  grid.addEventListener('click', e => {
    const sizeCard = e.target.closest('[data-size-charts]')
    if (sizeCard) { openSizeCharts(sizeCard); return }
    const card = e.target.closest('[data-href]')
    if (!card) return
    location.hash = card.dataset.href
  })

  grid.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const sizeCard = e.target.closest('[data-size-charts]')
      if (sizeCard) { openSizeCharts(sizeCard); return }
      const card = e.target.closest('[data-href]')
      if (!card) return
      location.hash = card.dataset.href
    }
  })

  return () => shown
}
