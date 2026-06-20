const CART_KEY = 'mychouchou_cart'
const SOURCE_KEY = 'mychouchou_source'

export function saveSourceFromUrl() {
  const params = new URLSearchParams(location.search)
  const from = params.get('from')
  if (from) {
    localStorage.setItem(SOURCE_KEY, from)
    params.delete('from')
    const newSearch = params.toString()
    const newUrl = location.pathname + (newSearch ? '?' + newSearch : '') + location.hash
    // 카카오 인앱브라우저는 replaceState가 URL 바에 반영되지 않으므로 location.replace 사용
    if (/KAKAOTALK/i.test(navigator.userAgent)) {
      sessionStorage.setItem('__from_redirect', from)
      location.replace(newUrl)
    } else {
      history.replaceState(null, '', newUrl)
    }
  } else {
    const redirectFrom = sessionStorage.getItem('__from_redirect')
    if (redirectFrom) {
      sessionStorage.removeItem('__from_redirect')
      localStorage.setItem(SOURCE_KEY, redirectFrom)
    } else {
      localStorage.removeItem(SOURCE_KEY)
    }
  }
}

export function getSource() {
  return localStorage.getItem(SOURCE_KEY) || ''
}

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]')
  } catch {
    return []
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

export function addToCart(item) {
  const cart = getCart()
  const existing = cart.find(c => c.id === item.id && c.size === item.size && c.selectedColor === item.selectedColor)
  if (existing) {
    existing.quantity = (existing.quantity || 1) + (item.quantity || 1)
    saveCart(cart)
    return 'updated'
  }
  cart.push(item)
  saveCart(cart)
  return 'added'
}

export function removeFromCart(id, size, color) {
  saveCart(getCart().filter(c => !(c.id === id && c.size === size && c.selectedColor === (color ?? c.selectedColor))))
}

export function clearCart() {
  localStorage.removeItem(CART_KEY)
}

export function updateCartItemQty(id, size, color, qty) {
  const cart = getCart()
  const item = cart.find(c => c.id === id && c.size === size && c.selectedColor === color)
  if (!item) return
  if (qty < 1) {
    removeFromCart(id, size, color)
  } else {
    item.quantity = qty
    saveCart(cart)
  }
}

export function getCartCount() {
  return getCart().length
}

export function updateCartBadge() {
  const badge = document.getElementById('cart-count')
  if (!badge) return
  const count = getCartCount()
  badge.textContent = count
  badge.classList.toggle('cart-fab__count--hidden', count === 0)
}
