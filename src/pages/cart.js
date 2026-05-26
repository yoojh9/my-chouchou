import { getCart, removeFromCart, updateCartBadge } from '../cart.js'

const BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeZizFGM2RLkzbSWi9j0Utn-QgwbI2DowSWwC9FMoHO4nRGlg/viewform'
const ENTRY_PRODUCTS = 'entry.212051867'

function itemPrice(item) {
  return item.basePrice + Math.round(item.addPrice * 1.6)
}

function formatPrice(n) {
  return Number(n).toLocaleString('ko-KR') + '원'
}

function buildFormUrl(items) {
  const lines = items.map(item => {
    const price = itemPrice(item)
    const colorPart = item.selectedColor ? ` / ${item.selectedColor}` : ''
    return `${item.name}${colorPart} / ${item.size} / ${price.toLocaleString()}원`
  })
  return `${FORM_URL}?usp=pp_url&${ENTRY_PRODUCTS}=${encodeURIComponent(lines.join('\n'))}`
}

function renderContent(app) {
  const cart = getCart()
  const content = document.getElementById('cart-content')

  if (cart.length === 0) {
    content.innerHTML = `<div class="state-empty">장바구니가 비어 있어요</div>`
    return
  }

  const total = cart.reduce((sum, item) => sum + itemPrice(item), 0)

  const itemsHTML = cart.map(item => {
    const price = itemPrice(item)
    const meta = [item.selectedColor, item.size].filter(Boolean).join(' / ')
    return `
      <div class="cart-item">
        <div class="cart-item__info">
          <div class="cart-item__brand">${item.brand}</div>
          <div class="cart-item__name">${item.name}</div>
          ${meta ? `<div class="cart-item__meta">${meta}</div>` : ''}
          <div class="cart-item__price">${formatPrice(price)}</div>
        </div>
        <button class="cart-item__remove" data-id="${item.id}" data-size="${item.size}" aria-label="삭제">✕</button>
      </div>`
  }).join('')

  content.innerHTML = `
    <div class="cart-list">${itemsHTML}</div>
    <div class="cart-summary">
      <span class="cart-summary__label">총 ${cart.length}개</span>
      <span class="cart-summary__total">${formatPrice(total)}</span>
    </div>
    <div class="cart-actions">
      <button class="cart-order-btn" id="order-btn">주문서 작성하기</button>
    </div>`

  content.addEventListener('click', e => {
    const removeBtn = e.target.closest('.cart-item__remove')
    if (removeBtn) {
      removeFromCart(removeBtn.dataset.id, removeBtn.dataset.size)
      updateCartBadge()
      renderContent(app)
      return
    }

    if (e.target.id === 'order-btn') {
      const currentCart = getCart()
      if (currentCart.length === 0) return
      window.open(buildFormUrl(currentCart), '_blank')
    }
  }, { once: true })
}

export function renderCart(app) {
  app.innerHTML = `
    <div class="header">
      <button class="header__back" id="back-btn" aria-label="뒤로가기">
        ${BACK_SVG}홈
      </button>
      <span class="header__title">장바구니</span>
    </div>
    <div id="cart-content" style="padding-bottom:100px"></div>`

  document.getElementById('back-btn').addEventListener('click', () => {
    location.hash = '#/'
  })

  renderContent(app)
}
