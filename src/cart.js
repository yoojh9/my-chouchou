const CART_KEY = 'mychouchou_cart'

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
  if (cart.some(c => c.id === item.id && c.size === item.size && c.selectedColor === item.selectedColor)) return false
  cart.push(item)
  saveCart(cart)
  return true
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
