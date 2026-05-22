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
  const localPath = imgObj.local
  const remoteUrl = imgObj.url || ''

  // Try local path first; fallback to remote URL on error
  const src = localPath
    ? `images/${localPath.replace(/^.*?images\//, '')}`
    : remoteUrl

  const fallback = remoteUrl
    ? `if(this.src!=='${remoteUrl}'){this.src='${remoteUrl}'}`
    : `this.style.display='none'`

  return `
    <div class="product-detail__img-wrap img-placeholder">
      <img class="product-detail__img"
        src="${src}"
        alt="상세 이미지 ${idx + 1}"
        loading="${idx === 0 ? 'eager' : 'lazy'}"
        data-full="${remoteUrl || src}"
        onerror="${fallback}"
      >
    </div>
  `
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
    </div>
  `
}

export async function renderProduct(app, brandId, productId) {
  app.innerHTML = `
    <div class="header">
      <button class="header__back" id="back-btn" aria-label="뒤로가기">←</button>
      <span class="header__title">상품 정보</span>
    </div>
    <div id="product-content" style="padding-bottom:16px">
      <div class="state-empty">불러오는 중...</div>
    </div>
  `

  document.getElementById('back-btn').addEventListener('click', () => {
    location.hash = `#/brand/${encodeURIComponent(brandId)}`
  })

  let allProducts
  try {
    const res = await fetch(`data/joykids/brands/${encodeURIComponent(brandId)}.json`)
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

  document.querySelector('.header__title').textContent = product.name

  const detailImages = product.detail_images || []
  const imagesHTML = detailImages.length
    ? detailImages.map((img, i) => detailImageHTML(img, i)).join('')
    : `<div style="padding:32px;text-align:center;color:#bbb">이미지 없음</div>`

  const orig = product.price_original
  const sale = product.price_sale
  const originalPriceHTML = orig && orig !== sale
    ? `<span class="product-detail__price-original">${formatPrice(orig)}</span>`
    : ''

  content.innerHTML = `
    <div class="product-detail__images">${imagesHTML}</div>
    <div class="product-detail__info">
      <div class="product-detail__name">${product.name}</div>
      <div class="product-detail__prices">
        <span class="product-detail__price-sale">${formatPrice(sale)}</span>
        ${originalPriceHTML}
      </div>
      <div class="product-detail__meta">
        ${product.colors ? `
          <div class="product-detail__meta-row">
            <span class="product-detail__meta-label">색상</span>
            <span class="product-detail__meta-value">${product.colors}</span>
          </div>
        ` : ''}
        ${product.size_range ? `
          <div class="product-detail__meta-row">
            <span class="product-detail__meta-label">사이즈</span>
            <span class="product-detail__meta-value">${product.size_range}</span>
          </div>
        ` : ''}
        ${product.mfg_date ? `
          <div class="product-detail__meta-row">
            <span class="product-detail__meta-label">입고일</span>
            <span class="product-detail__meta-value">${product.mfg_date}</span>
          </div>
        ` : ''}
      </div>
      ${sizeTagsHTML(product.size_options)}
    </div>
  `

  // Lightbox on image click
  content.addEventListener('click', e => {
    const img = e.target.closest('.product-detail__img')
    if (!img) return
    const src = img.dataset.full || img.src
    if (src) openLightbox(src)
  })
}
