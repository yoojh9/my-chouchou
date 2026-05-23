const BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`

function formatPrice(n) {
  return Number(n).toLocaleString('ko-KR') + '원'
}

function openLightbox(imgSrc) {
  const overlay = document.createElement('div')
  overlay.className = 'lightbox'
  const img = document.createElement('img')
  img.className = 'lightbox__img'
  img.src = imgSrc
  overlay.appendChild(img)
  overlay.addEventListener('click', () => overlay.remove())
  document.body.appendChild(overlay)
}

function detailImageHTML(imgObj, idx) {
  const src = imgObj.url || ''
  if (!src) return ''

  return `
    <div class="product-detail__img-wrap skeleton" data-img-wrap>
      <img class="product-detail__img"
        src="${src}"
        alt="상세 이미지 ${idx + 1}"
        loading="${idx === 0 ? 'eager' : 'lazy'}"
        data-full="${src}"
        onload="this.classList.add('is-loaded');this.closest('[data-img-wrap]').classList.remove('skeleton')"
        onerror="this.closest('[data-img-wrap]').classList.add('is-error');this.closest('[data-img-wrap]').classList.remove('skeleton');this.remove()"
      >
    </div>`
}

function attachImageSkeletonCleanup(container) {
  container.querySelectorAll('[data-img-wrap] img').forEach(img => {
    if (img.complete && img.naturalWidth) {
      img.classList.add('is-loaded')
      img.closest('[data-img-wrap]').classList.remove('skeleton')
    }
  })
}

function sizeTagsHTML(sizeOptions) {
  if (!sizeOptions || !sizeOptions.length) return ''
  const validSizes = sizeOptions.filter(s => s.name && s.name !== '-------------------')
  if (!validSizes.length) return ''
  const tags = validSizes.map(s => {
    const extraClass = s.add_price > 0 ? ' product-detail__size-tag--extra' : ''
    const label = s.add_price > 0
      ? `${s.name} <small>(+${s.add_price.toLocaleString()}원)</small>`
      : s.name
    return `<span class="product-detail__size-tag${extraClass}">${label}</span>`
  }).join('')
  return `
    <div class="product-detail__sizes">
      <div class="product-detail__sizes-title">사이즈</div>
      <div class="product-detail__size-tags">${tags}</div>
    </div>`
}

export async function renderProduct(app, brandId, productId) {
  app.innerHTML = `
    <div class="header">
      <button class="header__back" id="back-btn" aria-label="뒤로가기">
        ${BACK_SVG}${brandId}
      </button>
    </div>
    <div id="product-content" style="padding-bottom:32px">
      <div class="state-empty">불러오는 중...</div>
    </div>`

  document.getElementById('back-btn').addEventListener('click', () => {
    location.hash = `#/brand/${encodeURIComponent(brandId)}`
  })

  let allProducts
  try {
    const res = await fetch(`data/i54/brands/${encodeURIComponent(brandId)}.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    allProducts = await res.json()
  } catch (e) {
    document.getElementById('product-content').innerHTML =
      `<div class="state-error">데이터를 불러오지 못했습니다.</div>`
    return
  }

  const product = allProducts.find(p => String(p.id) === String(productId))
  const content = document.getElementById('product-content')

  if (!product) {
    content.innerHTML = `<div class="state-empty">상품을 찾을 수 없습니다.</div>`
    return
  }

  const displayName = (() => {
    const n = product.name || ''
    const dotIdx = n.indexOf('.')
    return dotIdx !== -1 ? n.slice(dotIdx + 1).trim() : n
  })()

  const detailImages = product.detail_images || []
  const imagesHTML = detailImages.length
    ? detailImages.map((img, i) => detailImageHTML(img, i)).join('')
    : `<div style="padding:48px;text-align:center;color:#bbb;font-size:14px">이미지 없음</div>`

  content.innerHTML = `
    <div class="product-detail__info">
      <div class="product-detail__brand">${brandId}</div>
      <div class="product-detail__name">${displayName}</div>
      <div class="product-detail__prices">
        <span class="product-detail__price-sale">${formatPrice(product.price_original)}</span>
      </div>
      <div class="product-detail__divider"></div>
      <div class="product-detail__meta">
        ${product.colors ? `
          <div class="product-detail__meta-row">
            <span class="product-detail__meta-label">색상</span>
            <span class="product-detail__meta-value">${product.colors}</span>
          </div>` : ''}
        ${product.size_range ? `
          <div class="product-detail__meta-row">
            <span class="product-detail__meta-label">사이즈</span>
            <span class="product-detail__meta-value">${product.size_range}</span>
          </div>` : ''}
        ${product.mfg_date ? `
          <div class="product-detail__meta-row">
            <span class="product-detail__meta-label">입고일</span>
            <span class="product-detail__meta-value">${product.mfg_date}</span>
          </div>` : ''}
      </div>
      ${sizeTagsHTML(product.size_options)}
    </div>
    <div class="product-detail__images">${imagesHTML}</div>`

  attachImageSkeletonCleanup(content)

  content.addEventListener('click', e => {
    const img = e.target.closest('.product-detail__img')
    if (!img) return
    const src = img.dataset.full || img.src
    if (src) openLightbox(src)
  })
}
