import './style.css'
import { renderHome } from './pages/home.js'
import { renderBrand } from './pages/brand.js'
import { renderProduct } from './pages/product.js'

const app = document.getElementById('app')

async function router() {
  const hash = location.hash || '#/'

  if (hash === '#/' || hash === '#') {
    await renderHome(app)
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
