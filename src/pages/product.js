import { addToCart, updateCartBadge } from '../cart.js'

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

function parseColors(colorsStr) {
  if (!colorsStr) return []
  return colorsStr.split('/').map(c => c.trim()).filter(Boolean)
}

function colorTagsHTML(colorsStr) {
  const colors = parseColors(colorsStr)
  if (!colors.length) return ''
  const tags = colors.map(c =>
    `<button class="product-detail__color-tag" data-color="${c}">${c}</button>`
  ).join('')
  return `
    <div class="product-detail__sizes product-detail__colors-section">
      <div class="product-detail__sizes-title">색상</div>
      <div class="product-detail__size-tags">${tags}</div>
    </div>`
}

function sizeTagsHTML(sizeOptions) {
  if (!sizeOptions || !sizeOptions.length) return ''
  const validSizes = sizeOptions.filter(s => s.name && s.name !== '-------------------')
  if (!validSizes.length) return ''
  const tags = validSizes.map(s => {
    const extraClass = s.add_price > 0 ? ' product-detail__size-tag--extra' : ''
    const label = s.add_price > 0
      ? `${s.name} <small>(+${Math.round(s.add_price * 1.6).toLocaleString()}원)</small>`
      : s.name
    return `<button class="product-detail__size-tag${extraClass}" data-size="${s.name}" data-add-price="${s.add_price}">${label}</button>`
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

  let allProducts, soldoutIds
  try {
    const [productsRes, soldoutRes] = await Promise.all([
      fetch(`data/i54/brands/${encodeURIComponent(brandId)}.json`),
      fetch('data/soldout.json'),
    ])
    if (!productsRes.ok) throw new Error(`HTTP ${productsRes.status}`)
    allProducts = await productsRes.json()
    soldoutIds = new Set((soldoutRes.ok ? await soldoutRes.json() : []).map(String))
  } catch (e) {
    document.getElementById('product-content').innerHTML =
      `<div class="state-error">데이터를 불러오지 못했습니다.</div>`
    return
  }

  const product = allProducts.find(p => String(p.id) === String(productId))
  const isSoldout = soldoutIds.has(String(productId))
  const content = document.getElementById('product-content')

  if (!product) {
    content.innerHTML = `<div class="state-empty">상품을 찾을 수 없습니다.</div>`
    return
  }

  const colors = parseColors(product.colors)
  // auto-select if only one color
  let selectedColor = colors.length === 1 ? colors[0] : null
  let selectedSize = null
  let selectedAddPrice = 0
  let quantity = 1

  const detailImages = product.detail_images || []
  const imagesHTML = detailImages.length
    ? detailImages.map((img, i) => detailImageHTML(img, i)).join('')
    : `<div style="padding:48px;text-align:center;color:#bbb;font-size:14px">이미지 없음</div>`

  content.innerHTML = `
    <div class="product-detail__info">
      <div class="product-detail__brand">${brandId}</div>
      <div class="product-detail__name">${product.name || ''}</div>
      ${isSoldout ? '<div class="soldout-label">품절</div>' : ''}
      <div class="product-detail__prices">
        <span class="product-detail__price-sale">${formatPrice(product.price_original)}</span>
      </div>
      <div class="product-detail__divider"></div>
      <div class="product-detail__meta">
        ${product.mfg_date ? `
          <div class="product-detail__meta-row">
            <span class="product-detail__meta-label">입고일</span>
            <span class="product-detail__meta-value">${product.mfg_date}</span>
          </div>` : ''}
      </div>
      ${colorTagsHTML(product.colors)}
      ${sizeTagsHTML(product.size_options)}
      <div class="product-detail__qty-row">
        <span class="product-detail__qty-label">수량</span>
        <div class="qty-stepper">
          <button class="qty-stepper__btn" id="qty-minus">−</button>
          <span class="qty-stepper__num" id="qty-num">1</span>
          <button class="qty-stepper__btn" id="qty-plus">+</button>
        </div>
      </div>
      <button class="product-detail__cart-btn" id="cart-btn" disabled>색상과 사이즈를 선택해주세요</button>
    </div>
    <div class="product-detail__images">${imagesHTML}</div>`

  attachImageSkeletonCleanup(content)

  // mark auto-selected color
  if (selectedColor) {
    content.querySelector(`.product-detail__color-tag[data-color="${selectedColor}"]`)
      ?.classList.add('is-selected')
  }

  function updateCartBtn() {
    const cartBtn = document.getElementById('cart-btn')
    if (!cartBtn) return
    const needColor = colors.length > 1
    const ready = (!needColor || selectedColor) && selectedSize
    cartBtn.disabled = !ready
    if (ready) {
      cartBtn.textContent = '장바구니 담기'
      cartBtn.classList.remove('is-added')
    } else if (!selectedColor && needColor) {
      cartBtn.textContent = '색상을 선택해주세요'
    } else {
      cartBtn.textContent = '사이즈를 선택해주세요'
    }
  }

  content.addEventListener('click', e => {
    const img = e.target.closest('.product-detail__img')
    if (img) {
      const src = img.dataset.full || img.src
      if (src) openLightbox(src)
      return
    }

    const colorTag = e.target.closest('.product-detail__color-tag[data-color]')
    if (colorTag) {
      content.querySelectorAll('.product-detail__color-tag').forEach(b => b.classList.remove('is-selected'))
      colorTag.classList.add('is-selected')
      selectedColor = colorTag.dataset.color
      updateCartBtn()
      return
    }

    const sizeTag = e.target.closest('.product-detail__size-tag[data-size]')
    if (sizeTag) {
      content.querySelectorAll('.product-detail__size-tag').forEach(b => b.classList.remove('is-selected'))
      sizeTag.classList.add('is-selected')
      selectedSize = sizeTag.dataset.size
      selectedAddPrice = Number(sizeTag.dataset.addPrice)
      updateCartBtn()
      return
    }

    if (e.target.id === 'qty-minus') {
      if (quantity > 1) {
        quantity--
        document.getElementById('qty-num').textContent = quantity
      }
      return
    }

    if (e.target.id === 'qty-plus') {
      quantity++
      document.getElementById('qty-num').textContent = quantity
      return
    }

    const cartBtn = e.target.closest('#cart-btn')
    if (cartBtn && !cartBtn.disabled) {
      const success = addToCart({
        id: String(product.id),
        brand: brandId,
        name: product.name,
        selectedColor: selectedColor || '',
        size: selectedSize,
        addPrice: selectedAddPrice,
        basePrice: product.price_original,
        quantity,
      })
      if (success) {
        cartBtn.textContent = '담겼어요 ✓'
        cartBtn.classList.add('is-added')
        updateCartBadge()
      } else {
        cartBtn.textContent = '이미 담겨 있어요'
      }
    }
  })
}
