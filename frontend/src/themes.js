export const THEMES = {
  lcs: {
    name: 'LCS',
    colors: ['#005EB8', '#1D8DD1', '#54B4E9', '#F28E1C', '#FDCB0A', '#6FB13B', '#A3D55D'],
  },
  halloween:    { name: 'Halloween 🎃',      colors: ['#EA580C','#7C3AED','#D97706','#6D28D9','#F97316','#9333EA','#C2410C','#4C1D95'] },
  christmas:    { name: 'Christmas 🎄',       colors: ['#DC2626','#16A34A','#B91C1C','#15803D','#991B1B','#166534','#7F1D1D','#14532D'] },
  thanksgiving: { name: 'Thanksgiving 🦃',   colors: ['#92400E','#B45309','#78350F','#D97706','#A16207','#854D0E','#713F12','#CA8A04'] },
  newyear:      { name: "New Year's 🎆",      colors: ['#B45309','#1D4ED8','#92400E','#1E40AF','#D97706','#2563EB','#A16207','#3B82F6'] },
  valentines:   { name: "Valentine's 💝",     colors: ['#BE185D','#9D174D','#DB2777','#831843','#EC4899','#500724','#F472B6','#701A75'] },
  stpatrick:    { name: "St. Patrick's 🍀",   colors: ['#15803D','#166534','#16A34A','#14532D','#4ADE80','#166534','#22C55E','#052E16'] },
  july4:        { name: 'July 4th 🎇',        colors: ['#DC2626','#1D4ED8','#B91C1C','#1E40AF','#991B1B','#2563EB','#7F1D1D','#3B82F6'] },
  summer:       { name: 'Summer Solstice ☀️', colors: ['#0284C7','#FACC15','#FB923C','#4ADE80','#22D3EE','#FDE047','#F97316','#86EFAC'] },
  easter:       { name: 'Easter 🐣',          colors: ['#C084FC','#F9A8D4','#FDE68A','#86EFAC','#A5B4FC','#FBCFE8','#D9F99D','#BAE6FD'] },
}

// Easter dates (calculated ahead — update every few years)
const EASTER_DATES = [
  { year: 2025, month: 4, day: 20 },
  { year: 2026, month: 4, day: 5  },
  { year: 2027, month: 3, day: 28 },
  { year: 2028, month: 4, day: 16 },
  { year: 2029, month: 4, day: 1  },
  { year: 2030, month: 4, day: 21 },
]

// Fixed-date holidays
const HOLIDAYS = [
  { name: "New Year's Day",    theme: 'newyear',      month: 1,  day: 1  },
  { name: "Valentine's Day",   theme: 'valentines',   month: 2,  day: 14 },
  { name: "St. Patrick's Day", theme: 'stpatrick',    month: 3,  day: 17 },
  { name: 'July 4th',          theme: 'july4',        month: 7,  day: 4  },
  { name: 'Summer Solstice',   theme: 'summer',       month: 6,  day: 21 },
  { name: 'Halloween',         theme: 'halloween',    month: 10, day: 31 },
  { name: 'Thanksgiving',      theme: 'thanksgiving', month: 11, day: 28 },
  { name: 'Christmas',         theme: 'christmas',    month: 12, day: 25 },
]

export function resolveTheme(themeKey, leadDays = 20, referenceDate = null) {
  if (themeKey && themeKey !== 'auto') {
    return { holiday: null, theme: themeKey, colors: THEMES[themeKey]?.colors ?? THEMES.lcs.colors }
  }

  const today = referenceDate || new Date()
  const year = today.getFullYear()
  let best = null
  let bestDiff = Infinity

  // Check fixed holidays
  for (const h of HOLIDAYS) {
    const diff = daysUntil(today, new Date(year, h.month - 1, h.day))
    if (diff >= 0 && diff <= leadDays && diff < bestDiff) {
      bestDiff = diff
      best = { name: h.name, theme: h.theme }
    }
  }

  // Check Easter for this year and next
  for (const e of EASTER_DATES) {
    const diff = daysUntil(today, new Date(e.year, e.month - 1, e.day))
    if (diff >= 0 && diff <= leadDays && diff < bestDiff) {
      bestDiff = diff
      best = { name: 'Easter', theme: 'easter' }
    }
  }

  if (best) {
    const t = THEMES[best.theme] ?? THEMES.lcs
    return { holiday: best.name, theme: best.theme, colors: t.colors }
  }

  return { holiday: null, theme: 'lcs', colors: THEMES.lcs.colors }
}

function daysUntil(today, target) {
  // If target already passed this year, try next year for fixed holidays
  const diff = Math.floor((target - today) / 86400000)
  if (diff < 0) {
    const nextYear = new Date(target)
    nextYear.setFullYear(target.getFullYear() + 1)
    return Math.floor((nextYear - today) / 86400000)
  }
  return diff
}

export function assignColors(names, colors) {
  const palette = [...colors]
  for (let i = palette.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [palette[i], palette[j]] = [palette[j], palette[i]]
  }
  return names.map((name, i) => ({ name, color: palette[i % palette.length] }))
}
