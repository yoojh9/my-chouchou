export function formatPrice(n) {
  return Number(n).toLocaleString('ko-KR') + '원'
}

export function sizeChipsHTML(product) {
  const opts = (product.sizes || [])
    .map(o => o.name)
    .filter(n => n && !/^-+$/.test(n))

  if (opts.length && opts.length <= 7) {
    return `<div class="product-card__sizes">${opts.map(s => `<span class="product-card__size-chip">${s}</span>`).join('')}</div>`
  }
  if (opts.length > 7) {
    return `<div class="product-card__sizes"><span class="product-card__size-chip">${opts[0]}~${opts[opts.length - 1]}</span></div>`
  }
  return ''
}

export function productCardHTML(product, brandId, soldoutIds) {
  const thumbUrl = product.thumbnail_url || ''
  const rawName = product.name || '상품명 없음'
  const isSale = rawName.includes('(세일)')
  const name = isSale ? rawName.replace('(세일) ', '') : rawName
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
        ${isSoldout ? '<div class="soldout-badge">품절</div>' : isSale ? '<div class="sale-badge">SALE</div>' : ''}
      </div>
      <div class="product-card__info">
        <div class="product-card__name">${name}</div>
        ${sizeChipsHTML(product)}
        <div class="product-card__bottom">
          <span class="product-card__price">${formatPrice(product.price_sale)}</span>
          ${product.colors?.length ? `<span class="product-card__color">${product.colors.map(c => c.name).join('/')}</span>` : ''}
        </div>
        ${product.mfg_date ? `<div class="product-card__mfg">${product.mfg_date.replaceAll('-', '/')} 업데이트</div>` : ''}
      </div>
    </div>`
}
