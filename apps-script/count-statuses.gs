/**
 * 주문 내역 칸에 쓰인 상태 값을 전부 세어 실행 로그에 보여주는 점검 함수 (상태 오타 검사용).
 * Apps Script 편집기에서 orderStatusCountStatuses 를 실행한다. 배포와 무관하게 편집기에서 바로 돈다.
 * 사이트 order.js의 STEPS / RESTART / REFUND_FROM / REFUND 에 없는 값이 나오면 오타이거나 새 상태다.
 */
function orderStatusCountStatuses() {
  const normalize = s => String(s).replace(/\s/g, '')
  const total = {}   // 상태가 한 번이라도 나온 횟수
  const current = {} // 마지막(현재) 상태인 횟수
  const example = {} // 상태별 예시 줄 하나
  let lines = 0
  let noStatus = 0

  SpreadsheetApp.getActive().getSheets().forEach(sheet => {
    const lastCol = sheet.getLastColumn()
    if (sheet.getLastRow() < 2 || lastCol < 1) return
    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalize)
    const col = header.indexOf(normalize('주문 내역'))
    if (col === -1) return

    sheet.getRange(2, col + 1, sheet.getLastRow() - 1, 1).getValues().forEach(([cell]) => {
      String(cell).split('\n').map(s => s.trim())
        .filter(s => s && !/^from\s/i.test(s))
        .forEach(line => {
          lines++
          const statuses = line.split(/\s*(?:->|→)\s*/).slice(1).map(s => s.trim()).filter(Boolean)
          if (statuses.length === 0) { noStatus++; return }
          statuses.forEach(s => {
            total[s] = (total[s] || 0) + 1
            if (!example[s]) example[s] = line
          })
          const last = statuses[statuses.length - 1]
          current[last] = (current[last] || 0) + 1
        })
    })
  })

  const rows = Object.keys(total).sort((a, b) => total[b] - total[a])
  const out = [`상품 줄 ${lines}개 (상태 없음 ${noStatus}개), 상태 값 ${rows.length}종`, '']
  rows.forEach(s => out.push(`[${s}] ${total[s]}회 · 현재 상태 ${current[s] || 0}개  예) ${example[s]}`))
  Logger.log(out.join('\n'))
}
