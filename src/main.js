import './style.css'
import { renderHome, resetHomeState } from './pages/home.js'
import { renderBrand } from './pages/brand.js'
import { renderProduct } from './pages/product.js'
import { renderCart } from './pages/cart.js'
import { updateCartBadge, saveSourceFromUrl, getSource } from './cart.js'

saveSourceFromUrl()

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
  if (!getSource()) return
  location.hash = '#/cart'
})

updateCartBadge()

let homeScrollY = 0
let restoreHomeScroll = false
const brandScrollY = {}
const brandShownCount = {}
let restoreBrandScroll = null
let currentBrandGetShown = null
let lastListHash = '#/'

async function router() {
  const hash = location.hash || '#/'

  if (hash === '#/' || hash === '#') {
    await renderHome(app)
    if (restoreHomeScroll) {
      window.scrollTo(0, homeScrollY)
      restoreHomeScroll = false
    }
  } else if (hash === '#/cart') {
    if (!getSource()) { location.hash = '#/'; return }
    renderCart(app)
    window.scrollTo(0, 0)
  } else if (hash.startsWith('#/brand/')) {
    const brandId = decodeURIComponent(hash.slice('#/brand/'.length))
    currentBrandGetShown = await renderBrand(app, brandId, brandShownCount[brandId] || 0)
    if (restoreBrandScroll === brandId) {
      window.scrollTo(0, brandScrollY[brandId] || 0)
    } else {
      window.scrollTo(0, 0)
    }
    restoreBrandScroll = null
  } else if (hash.startsWith('#/product/')) {
    const rest = hash.slice('#/product/'.length)
    const slashIdx = rest.indexOf('/')
    if (slashIdx === -1) return
    const brandId = decodeURIComponent(rest.slice(0, slashIdx))
    const productId = decodeURIComponent(rest.slice(slashIdx + 1))
    await renderProduct(app, brandId, productId, lastListHash)
    window.scrollTo(0, 0)
  } else {
    await renderHome(app)
  }
}

window.addEventListener('hashchange', (e) => {
  const oldHash = new URL(e.oldURL).hash || '#/'
  const newHash = new URL(e.newURL).hash || '#/'

  if (oldHash === '#/' || oldHash === '#') {
    homeScrollY = window.scrollY
    lastListHash = '#/'
  } else if (oldHash.startsWith('#/brand/')) {
    const brandId = decodeURIComponent(oldHash.slice('#/brand/'.length))
    brandScrollY[brandId] = window.scrollY
    if (currentBrandGetShown) brandShownCount[brandId] = currentBrandGetShown()
    currentBrandGetShown = null
    lastListHash = oldHash
  }

  if (newHash === '#/' || newHash === '#') {
    restoreHomeScroll = true
  } else if (newHash.startsWith('#/brand/')) {
    const newBrandId = decodeURIComponent(newHash.slice('#/brand/'.length))
    if (oldHash.startsWith('#/product/') || oldHash === '#/cart') {
      // 상품 상세나 장바구니에서 뒤로 왔을 때만 스크롤/로드 상태 복원
      restoreBrandScroll = newBrandId
    } else {
      // 홈 등 다른 곳에서 새로 진입하면 처음부터 보여준다
      delete brandScrollY[newBrandId]
      delete brandShownCount[newBrandId]
    }
  }

  router()
})

window.addEventListener('load', router)

app.addEventListener('click', e => {
  if (!e.target.closest('.header__logo, .home-header__logo')) return
  resetHomeState()
  homeScrollY = 0
  restoreHomeScroll = false
  if (location.hash === '#/' || location.hash === '#' || !location.hash) {
    renderHome(app)
    window.scrollTo(0, 0)
  } else {
    location.hash = '#/'
  }
})
