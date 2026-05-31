import { useState, useRef, useEffect } from 'react'

const TILE_W = 190
const TILE_H = 90
const COLS = 3
const PAD = 14
const HEADER_H = 60
const FACTS_H = 110
const HOLIDAY_H = 30

function drawScreenshot(canvas, tiles, podName, dateStr, facts, holidayName, themeColors) {
  const ctx = canvas.getContext('2d')
  const rows = Math.ceil(tiles.length / COLS)
  const W = COLS * TILE_W + (COLS + 1) * PAD
  const hasHoliday = !!holidayName
  const hasFacts = facts && (
    facts.national_days?.length > 0 ||
    facts.on_this_day?.length > 0 ||
    facts.famous_birthdays?.length > 0
  )
  const H = (hasHoliday ? HOLIDAY_H : 0) +
            HEADER_H +
            (hasFacts ? FACTS_H : 0) +
            rows * TILE_H + (rows + 1) * PAD

  canvas.width = W
  canvas.height = H

  let yOffset = 0
  const accentColor = themeColors?.[0] ?? '#2563EB'
  const accentColor2 = themeColors?.[1] ?? '#16A34A'

  // ── Holiday banner ──────────────────────────────────────────────────────
  if (hasHoliday) {
    ctx.fillStyle = '#F59E0B'
    ctx.fillRect(0, 0, W, HOLIDAY_H)
    ctx.fillStyle = '#1C1917'
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`🎉 ${holidayName} — Auto Theme Active`, W / 2, HOLIDAY_H / 2)
    yOffset += HOLIDAY_H
  }

  // ── Header ──────────────────────────────────────────────────────────────
  // Gradient background
  const grad = ctx.createLinearGradient(0, yOffset, W, yOffset + HEADER_H)
  grad.addColorStop(0, accentColor)
  grad.addColorStop(1, accentColor2)
  ctx.fillStyle = grad
  ctx.fillRect(0, yOffset, W, HEADER_H)

  // Subtle overlay
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(0, yOffset, W, HEADER_H)

  // Pod name
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px Inter, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${podName} Stand-Up`, PAD, yOffset + HEADER_H / 2 - 6)

  // Date
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = '14px Inter, system-ui, sans-serif'
  ctx.fillText(dateStr, PAD, yOffset + HEADER_H / 2 + 14)

  // Member count badge
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  const badge = `${tiles.length} members`
  ctx.font = '12px Inter, system-ui, sans-serif'
  const bw = ctx.measureText(badge).width + 16
  roundRect(ctx, W - bw - PAD, yOffset + HEADER_H / 2 - 12, bw, 24, 12)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText(badge, W - bw / 2 - PAD, yOffset + HEADER_H / 2)

  yOffset += HEADER_H

  // ── Facts strip ─────────────────────────────────────────────────────────
  if (hasFacts) {
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, yOffset, W, FACTS_H)

    // Bottom separator line
    ctx.fillStyle = accentColor
    ctx.fillRect(0, yOffset + FACTS_H - 2, W, 2)

    const colW = W / 3
    const sections = []

    if (facts.national_days?.length > 0) {
      sections.push({
        title: '🎊 National Days',
        items: facts.national_days.slice(0, 4).map(d => typeof d === 'object' ? d.name : d),
      })
    }
    if (facts.on_this_day?.length > 0) {
      sections.push({
        title: '🕰️ On This Day',
        items: facts.on_this_day.slice(0, 3).map(e => `${e.year} — ${_truncate(e.event, 45)}`),
      })
    }
    if (facts.famous_birthdays?.length > 0) {
      sections.push({
        title: '🎂 Birthdays',
        items: facts.famous_birthdays.slice(0, 3).map(b => `${b.name} (b.${b.birth_year})`),
      })
    }

    sections.slice(0, 3).forEach((section, si) => {
      const x = si * colW
      const innerX = x + 10
      const innerW = colW - 20

      // Section title
      ctx.fillStyle = '#94a3b8'
      ctx.font = 'bold 10px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(section.title, innerX, yOffset + 10)

      // Items
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '11px Inter, system-ui, sans-serif'
      section.items.forEach((item, ii) => {
        const text = typeof item === 'string' ? item : String(item)
        ctx.fillText(_truncate(text, 32), innerX, yOffset + 26 + ii * 22)
      })

      // Vertical divider
      if (si < sections.length - 1) {
        ctx.fillStyle = '#334155'
        ctx.fillRect(x + colW - 1, yOffset + 8, 1, FACTS_H - 16)
      }
    })

    yOffset += FACTS_H
  }

  // ── Background for tile area ─────────────────────────────────────────────
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, yOffset, W, H - yOffset)

  // ── Tiles ────────────────────────────────────────────────────────────────
  tiles.forEach((tile, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = PAD + col * (TILE_W + PAD)
    const y = yOffset + PAD + row * (TILE_H + PAD)

    // Tile background — use tile.color directly (no status check)
    const bg = tile.color || accentColor
    ctx.beginPath()
    roundRect(ctx, x, y, TILE_W, TILE_H, 10)
    ctx.fillStyle = bg
    ctx.fill()

    // Active border glow
    if (tile.isActive) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      roundRect(ctx, x - 1, y - 1, TILE_W + 2, TILE_H + 2, 11)
      ctx.stroke()
    }

    // Position badge
    if (tile.position) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.beginPath()
      ctx.arc(x + 16, y + 16, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(tile.position), x + 16, y + 16)
    }

    // On Deck badge
    if (tile.isOnDeck) {
      badgeText(ctx, 'On Deck', x + TILE_W - 8, y + 8, 'rgba(255,255,255,0.25)')
    }

    // Name
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 15px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(tile.name, x + TILE_W / 2, y + TILE_H / 2 + (tile.position ? 4 : 0))
  })
}

function _truncate(text, limit) {
  return text.length <= limit ? text : text.slice(0, limit).replace(/\s\S*$/, '') + '…'
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function badgeText(ctx, text, rightX, topY, bg) {
  ctx.font = 'bold 10px Inter, system-ui, sans-serif'
  const tw = ctx.measureText(text).width
  const bw = tw + 8
  const bh = 16
  ctx.fillStyle = bg
  ctx.beginPath()
  roundRect(ctx, rightX - bw, topY, bw, bh, 4)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, rightX - bw / 2, topY + bh / 2)
}

export default function ScreenshotModal({ tiles, podName, sessionDate, facts, holidayName, themeColors, onClose }) {
  const canvasRef = useRef(null)
  const [dateStr, setDateStr] = useState(() => {
    const d = sessionDate ? new Date(sessionDate + 'T12:00:00') : new Date()
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  })
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!canvasRef.current) return
    drawScreenshot(canvasRef.current, tiles, podName, dateStr, facts, holidayName, themeColors)
  }, [tiles, podName, dateStr, facts, holidayName, themeColors])

  async function copyToClipboard() {
    const canvas = canvasRef.current
    try {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setStatus('copied')
    } catch {
      download()
      setStatus('downloaded')
    }
  }

  function download() {
    const canvas = canvasRef.current
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `standup-${podName}-${sessionDate || 'today'}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">📷 Screenshot</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-slate-400">Date label:</label>
            <input
              className="flex-1 bg-slate-700 text-white text-sm rounded px-3 py-1.5"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
            />
          </div>
          <div className="overflow-auto rounded-lg border border-slate-600 bg-slate-900">
            <canvas ref={canvasRef} className="max-w-full" style={{ display: 'block' }} />
          </div>
        </div>

        {status === 'copied' && (
          <div className="mx-4 mb-2 px-3 py-2 bg-green-800/50 text-green-300 text-sm rounded text-center">
            ✓ Copied to clipboard — paste into Teams!
          </div>
        )}
        {status === 'downloaded' && (
          <div className="mx-4 mb-2 px-3 py-2 bg-blue-800/50 text-blue-300 text-sm rounded text-center">
            ✓ Downloaded (clipboard requires HTTPS)
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-700 flex gap-3 justify-end">
          <button onClick={download} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
            ⬇ Download
          </button>
          <button onClick={copyToClipboard} className="px-5 py-2 bg-violet-700 hover:bg-violet-600 text-white rounded-lg text-sm font-medium">
            📋 Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  )
}
