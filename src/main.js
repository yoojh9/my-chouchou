import './style.css'
import { renderHome } from './pages/home.js'
import { renderBrand } from './pages/brand.js'
import { renderProduct } from './pages/product.js'
import { renderCart } from './pages/cart.js'
import { updateCartBadge } from './cart.js'

const app = document.getElementById('app')

// Floating cart button
const fab = document.createElement('div')
fab.className = 'cart-fab'
fab.innerHTML = `
  <button class="cart-fab__btn" id="cart-fab-btn" aria-label="장바구니">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
    <span class="cart-fab__count cart-fab__count--hidden" id="cart-count">0</span>
  </button>`
document.body.appendChild(fab)

document.getElementById('cart-fab-btn').addEventListener('click', () => {
  location.hash = '#/cart'
})

updateCartBadge()

async function router() {
  const hash = location.hash || '#/'

  if (hash === '#/' || hash === '#') {
    await renderHome(app)
  } else if (hash === '#/cart') {
    renderCart(app)
  } else if (hash.startsWith('#/brand/')) {
    const brandId = decodeURIComponent(hash.slice('#/brand/'.length))
    await renderBrand(app, brandId)
  } else if (hash.startsWith('#/product/')) {
    const rest = hash.slice('#/product/'.length)
    const slashIdx = rest.indexOf('/')
    if (slashIdx === -1) return
    const brandId = decodeURIComponent(rest.slice(0, slashIdx))
    const productId = decodeURIComponent(rest.slice(slashIdx + 1))
    await renderProduct(app, brandId, productId)
  } else {
    await renderHome(app)
  }
}

window.addEventListener('hashchange', router)
window.addEventListener('load', router)
