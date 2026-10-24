const BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`

// 구글 Apps Script 웹 앱 URL (apps-script/order-status.gs를 배포하고 받은 /exec 주소)
const ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbz378ysq6nYY_lVrje3GzqPUPwRUGqji1IRa2r2eruEo40pCZHDdptw3i5Sd-Fi05R0/exec'

const PHONE_KEY = 'mychouchou_order_phone'
const TIMEOUT_MS = 15000

// 시트 '주문 내역' 칸의 한 줄: "상품명 / 색상 / 사이즈 / 1개 / 10,400원 -> 입고 -> 검수 -> 배송"
// 상태가 없으면 주문접수, 있으면 마지막 상태가 현재 상태다
const STEPS = ['주문접수', '입고', '검수', '배송']
// 다시 들여와야 하는 상태: 진행 단계를 처음부터 다시 센다
const RESTART = ['교환', '변경', '추가']
// 환불로 이어지는 상태: 빨간 진행 바(품절/삭제 → 환불)로 따로 보여준다.
// 품절은 항상 환불까지 가고, 삭제는 돈을 받은 뒤일 때만 환불이 붙는다 (삭제만 있으면 그대로 끝)
const REFUND = '환불'
const REFUND_FROM = ['품절', '삭제']

const ERROR_TEXT = {
  invalid: '주문번호와 전화번호 뒷자리 4자리를 확인해 주세요.',
  not_found: '주문 정보를 찾을 수 없어요. 주문번호와 전화번호 뒷자리를 확인해 주세요.',
  locked: '조회 시도가 너무 많아요. 15분 뒤에 다시 시도해 주세요.',
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// 같은 기기에서 다시 들어오면 뒷자리를 다시 묻지 않도록 주문번호별로 기억한다
function loadPhones() {
  try { return JSON.parse(localStorage.getItem(PHONE_KEY)) || {} } catch (_) { return {} }
}

function savePhone(order, phone) {
  try {
    const phones = loadPhones()
    if (phone) phones[order] = phone
    else delete phones[order]
    localStorage.setItem(PHONE_KEY, JSON.stringify(phones))
  } catch (_) { /* 저장 실패는 무시 */ }
}

async function fetchOrder(order, phone) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const url = `${ORDER_API_URL}?order=${encodeURIComponent(order)}&phone=${encodeURIComponent(phone)}`
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function parseLine(line) {
  const [info, ...rest] = line.split(/\s*(?:->|→)\s*/)
  const history = rest.map(x => x.trim()).filter(Boolean)
  const parts = info.split('/').map(x => x.trim()).filter(Boolean)
  const price = parts.length > 1 && /원$/.test(parts[parts.length - 1]) ? parts.pop() : ''
  const qty = parts.length > 1 && /^\d+\s*개$/.test(parts[parts.length - 1]) ? parts.pop() : ''
  const name = parts.shift() || info.trim()
  const status = history[history.length - 1] || STEPS[0]

  let step = 0
  history.forEach(h => {
    if (RESTART.includes(h)) step = 0
    else if (STEPS.indexOf(h) > 0) step = STEPS.indexOf(h)
  })

  let track = { steps: STEPS, step, refund: false }
  let removed = status === '삭제'
  if (status === '품절') track = { steps: ['품절', REFUND], step: 0, refund: true }
  if (status === '삭제') track = null
  if (status === REFUND) {
    const from = history.slice(0, -1).reverse().find(h => REFUND_FROM.includes(h))
    track = from ? { steps: [from, REFUND], step: 1, refund: true } : null
    removed = from === '삭제'
  }

  return { name, options: parts, qty, price, status, track, removed }
}

function stepsHTML(track) {
  if (!track) return ''
  const { steps, step, refund } = track
  return `
    <ol class="order-steps${refund ? ' order-steps--refund' : ''}">
      ${steps.map((s, i) => `
        <li class="order-steps__item${i < step ? ' is-done' : ''}${i === step ? ' is-current' : ''}">
          <span class="order-steps__dot"></span>
          <span class="order-steps__label">${s}</span>
        </li>`).join('')}
    </ol>`
}

function badgeKind(status) {
  if (status === STEPS[STEPS.length - 1]) return 'done'
  if (status === REFUND) return 'refund-done'
  if (REFUND_FROM.includes(status)) return 'stop'
  return 'active'
}

function itemHTML(item) {
  const meta = [...item.options, item.qty].filter(Boolean).join(' / ')
  return `
    <div class="order-item${item.removed ? ' order-item--removed' : ''}">
      <div class="order-item__top">
        <div class="order-item__name">${esc(item.name)}</div>
        <span class="order-badge order-badge--${badgeKind(item.status)}">${esc(item.status)}</span>
      </div>
      ${meta || item.price ? `<div class="order-item__meta">${esc(meta)}${item.price ? `<span class="order-item__price">${esc(item.price)}</span>` : ''}</div>` : ''}
      ${stepsHTML(item.track)}
    </div>`
}

function summaryHTML(items) {
  const counts = {}
  items.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1 })
  const order = [...STEPS, ...RESTART, ...REFUND_FROM, REFUND]
  const keys = Object.keys(counts).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
  return `
    <div class="order-summary">
      <span class="order-summary__total">상품 ${items.length}개</span>
      ${keys.map(k => `<span class="order-badge order-badge--${badgeKind(k)}">${esc(k)} ${counts[k]}</span>`).join('')}
    </div>`
}

function resultHTML(data) {
  const items = (data.lines || []).map(parseLine)
  return `
    <div class="order-result">
      <div class="order-result__head">
        <div>
          <div class="order-result__label">주문번호</div>
          <div class="order-result__no">${esc(data.order)}</div>
        </div>
        <button class="order-result__refresh" id="order-refresh">새로고침</button>
      </div>
      ${items.length ? summaryHTML(items) + items.map(itemHTML).join('') : '<div class="state-empty">등록된 상품이 아직 없어요</div>'}
      <button class="order-result__other" id="order-other">다른 주문 조회하기</button>
    </div>`
}

function formHTML(order, error) {
  return `
    <form class="order-form" id="order-form" novalidate>
      <p class="order-form__intro">주문하신 상품의 입고·배송 상태를 확인할 수 있어요.</p>
      <label class="order-form__field">
        <span>주문번호</span>
        <input class="order-form__input" name="order" inputmode="numeric" autocomplete="off" value="${esc(order)}" required>
      </label>
      <label class="order-form__field">
        <span>주문자 전화번호 뒷자리 4자리</span>
        <input class="order-form__input" name="phone" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="1234" required>
      </label>
      ${error ? `<div class="order-form__error">${esc(error)}</div>` : ''}
      <button class="cart-order-btn order-form__submit" type="submit">조회하기</button>
    </form>`
}

export function renderOrder(app, initialOrder = '') {
  app.innerHTML = `
    <div class="header">
      <button class="header__logo" aria-label="홈으로">마이슈슈</button>
      <div class="header__nav">
        <button class="header__back" id="back-btn" aria-label="홈으로">
          ${BACK_SVG}홈
        </button>
        <span class="header__title">주문 상태 조회</span>
      </div>
    </div>
    <div class="order-page" id="order-content"></div>`

  // iOS 카카오톡 웹뷰는 history.back()이 웹뷰를 닫아서 hash로 이동한다
  document.getElementById('back-btn').addEventListener('click', () => { location.hash = '#/' })

  const content = document.getElementById('order-content')
  // 조회 중에 다른 페이지로 가거나 다시 조회하면, 늦게 도착한 이전 응답은 버린다
  let seq = 0

  function showForm(order, error = '') {
    content.innerHTML = formHTML(order, error)
    const form = content.querySelector('#order-form')
    const target = order ? form.phone : form.order
    target.focus()
    form.addEventListener('submit', e => {
      e.preventDefault()
      lookup(form.order.value.trim(), form.phone.value.trim())
    })
  }

  async function lookup(order, phone) {
    if (!/^\d+$/.test(order) || !/^\d{4}$/.test(phone)) {
      showForm(order, ERROR_TEXT.invalid)
      return
    }
    const mySeq = ++seq
    content.innerHTML = '<div class="state-empty">주문 정보를 불러오는 중이에요…</div>'
    let data
    try {
      data = await fetchOrder(order, phone)
    } catch (_) {
      data = null
    }
    if (mySeq !== seq || !content.isConnected) return
    if (!data) {
      showForm(order, '조회에 실패했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    if (!data.ok) {
      savePhone(order, '')
      showForm(order, ERROR_TEXT[data.error] || ERROR_TEXT.not_found)
      return
    }
    savePhone(order, phone)
    content.innerHTML = resultHTML(data)
    content.querySelector('#order-refresh').addEventListener('click', () => lookup(order, phone))
    content.querySelector('#order-other').addEventListener('click', () => {
      savePhone(order, '')
      if (location.hash === '#/order') showForm('')
      else location.hash = '#/order'
    })
  }

  if (!ORDER_API_URL) {
    content.innerHTML = '<div class="state-empty">주문 조회 기능을 준비하고 있어요</div>'
    return
  }

  const savedPhone = initialOrder ? loadPhones()[initialOrder] : ''
  if (savedPhone) lookup(initialOrder, savedPhone)
  else showForm(initialOrder)
}
