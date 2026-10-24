/**
 * 마이슈슈 주문 상태 조회 API (Google Apps Script)
 *
 * 주문 탭에서 인덱스 + 연락처 뒷자리 4자리가 맞는 주문을 찾아, 그 주문의 '주문 내역' 칸을
 * 줄 단위로 돌려준다. 줄 해석(상품명 / 옵션 / 수량 / 가격 -> 상태 -> 상태)은 사이트 order.js가 한다.
 * 이름·주소 등 다른 열은 읽지 않는다.
 *
 * 기존 코드가 있는 Apps Script 프로젝트에 넣어도 되도록 모든 이름을 OrderStatus 안에 둔다.
 * 프로젝트 전체가 이름을 공유하므로, 바깥에 두는 것은 맨 아래 진입점 함수뿐이다.
 * 설치 방법은 README.md의 "주문 상태 조회" 참고.
 */

const OrderStatus = (() => {
  const SITE_URL = 'https://my-chouchou.com'

  // 1행에 이 헤더가 모두 있는 탭을 주문 탭으로 본다 (공백은 무시하고 비교)
  const HEADER = { order: '인덱스', phone: '연락처', items: '주문 내역' }

  // 같은 인덱스로 15분 안에 10번 틀리면 잠근다 (뒷자리 4자리 무작위 대입 방지)
  const MAX_FAILS = 10
  const LOCK_SECONDS = 15 * 60

  function doGet(e) {
    const order = String((e.parameter && e.parameter.order) || '').trim()
    const phone = String((e.parameter && e.parameter.phone) || '').trim()
    return json(lookup(order, phone))
  }

  function lookup(order, phone) {
    // 인덱스는 숫자만 받는다 (캐시 키 길이 제한 초과·이상한 입력 방지)
    if (!/^\d{1,10}$/.test(order) || !/^\d{4}$/.test(phone)) return { ok: false, error: 'invalid' }

    const cache = CacheService.getScriptCache()
    const failKey = 'orderstatus_fail:' + order
    const fails = Number(cache.get(failKey) || 0)
    if (fails >= MAX_FAILS) return { ok: false, error: 'locked' }

    // 같은 인덱스가 여러 번 있으면 (탭이 여러 개인 경우 등) 마지막 것을 쓴다
    let found = null
    orderSheets().forEach(({ sheet, col }) => {
      const orders = column(sheet, col.order)
      const phones = column(sheet, col.phone)
      orders.forEach((v, i) => {
        if (String(v).trim() === order && lastDigits(phones[i]) === phone) found = { sheet, col, row: i + 2 }
      })
    })

    // 주문이 없을 때와 뒷자리가 틀릴 때를 구분하지 않는다 (주문 존재 여부 노출 방지)
    if (!found) {
      cache.put(failKey, String(fails + 1), LOCK_SECONDS)
      return { ok: false, error: 'not_found' }
    }
    cache.remove(failKey)

    const raw = String(found.sheet.getRange(found.row, found.col.items).getValue())
    const lines = raw.split('\n')
      .map(s => s.trim())
      // 장바구니 주문서가 끝에 붙이는 유입경로 줄(from notion1)은 뺀다
      .filter(s => s && !/^from\s/i.test(s))
    return { ok: true, order, lines }
  }

  // 010-1234-5678 / 01012345678 / 숫자로 바뀐 1012345678 모두 뒷자리 4개로 비교
  function lastDigits(v) {
    return String(v).replace(/\D/g, '').slice(-4)
  }

  function normalize(s) {
    return String(s).replace(/\s/g, '')
  }

  function orderSheets() {
    return SpreadsheetApp.getActive().getSheets().map(sheet => {
      const lastCol = sheet.getLastColumn()
      if (sheet.getLastRow() < 2 || lastCol < 1) return null
      const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalize)
      const col = {}
      for (const [key, name] of Object.entries(HEADER)) {
        const i = header.indexOf(normalize(name))
        if (i === -1) return null
        col[key] = i + 1
      }
      return { sheet, col }
    }).filter(Boolean)
  }

  function column(sheet, col) {
    return sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues().map(r => r[0])
  }

  function json(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
  }

  // ── 시트 편의 기능 ──

  function onOpen() {
    SpreadsheetApp.getUi().createMenu('주문상태')
      .addItem('선택한 주문 링크 보기', 'orderStatusShowLink')
      .addToUi()
  }

  function showLink() {
    const ui = SpreadsheetApp.getUi()
    const sheet = SpreadsheetApp.getActiveSheet()
    const target = orderSheets().find(s => s.sheet.getSheetId() === sheet.getSheetId())
    const row = sheet.getActiveRange().getRow()
    const order = target && row > 1 ? String(sheet.getRange(row, target.col.order).getValue()).trim() : ''
    if (!order) {
      ui.alert('주문 탭에서 인덱스가 있는 줄을 선택해 주세요.')
      return
    }
    ui.alert('고객 안내 링크', `${SITE_URL}/#/order/${order}`, ui.ButtonSet.OK)
  }

  return { doGet, lookup, onOpen, showLink }
})()

// 메뉴에서 부르는 함수 (이름이 겹치지 않게 orderStatus 접두어)
function orderStatusShowLink() { OrderStatus.showLink() }

// ── 진입점 ──
// 기존 코드에 doGet / onOpen 이 이미 있으면 이 아래 블록은 지우고,
// 기존 함수 안에 OrderStatus.doGet(e) / OrderStatus.onOpen() 을 한 줄씩 넣는다.

function doGet(e) { return OrderStatus.doGet(e) }
function onOpen() { OrderStatus.onOpen() }
