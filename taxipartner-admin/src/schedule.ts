type Shift = {
  driver: string
  date: string
  start: string
  end: string
  vehicle?: string
  note?: string
  conflict?: boolean
}

const state = {
  rows: [] as Shift[],
  stats: { total: 0, drivers: 0, days: 0, conflicts: 0 },
  query: ""
}

const splitCSVLine = (line: string): string[] => {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === "\\" && i + 1 < line.length) {
      cur += line[++i]
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === "," && !inQuotes) {
      out.push(cur)
      cur = ""
      continue
    }
    cur += char
  }
  out.push(cur)
  return out
}

const normalizeDate = (value: string): string => {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const match = trimmed.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/)
  if (match) {
    const day = match[1].padStart(2, "0")
    const month = match[2].padStart(2, "0")
    const year = match[3].length === 2 ? `20${match[3]}` : match[3]
    return `${year}-${month}-${day}`
  }
  return trimmed
}

const normalizeTime = (value: string): string => {
  const trimmed = value.trim().replace(/^(\d{1}):/, "0$1:")
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed
  const match = trimmed.match(/^(\d{1,2})[.:](\d{1,2})$/)
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`
  }
  return trimmed
}

const toMinutes = (hm: string): number => {
  const [hours, minutes] = hm.split(":").map((segment) => parseInt(segment || "0", 10))
  return hours * 60 + minutes
}

const detectConflicts = (rows: Shift[]): Shift[] => {
  const grouped = new Map<string, Shift[]>()
  rows.forEach((row) => {
    const key = `${row.driver}@${row.date}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  })

  let conflicts = 0
  grouped.forEach((list) => {
    list.sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    for (let i = 0; i < list.length; i++) {
      const current = list[i]
      const start = toMinutes(current.start)
      const end = toMinutes(current.end)
      for (let j = i + 1; j < list.length; j++) {
        const compare = list[j]
        const cStart = toMinutes(compare.start)
        const cEnd = toMinutes(compare.end)
        if (cStart >= end) break
        if (Math.max(start, cStart) < Math.min(end, cEnd)) {
          if (!current.conflict) {
            current.conflict = true
            conflicts += 1
          }
          if (!compare.conflict) {
            compare.conflict = true
            conflicts += 1
          }
        }
      }
    }
  })

  state.stats.conflicts = conflicts
  return rows
}

const rebuildStats = (rows: Shift[]) => {
  state.stats.total = rows.length
  state.stats.drivers = new Set(rows.map((row) => row.driver)).size
  state.stats.days = new Set(rows.map((row) => row.date)).size
}

const sampleCSV = (): string =>
  [
    "driver,date,start,end,vehicle,note",
    "Ali,2025-10-16,08:00,12:00,TX-101,Gündüz",
    "Ali,2025-10-16,11:30,15:00,TX-101,ÇAKIŞIR",
    "Veli,16.10.2025,09:00,17:00,TX-202,Uzun vardiya",
    "Ayşe,2025-10-17,20:00,23:30,TX-303,Akşam",
    "Ali,2025-10-17,07:00,10:00,TX-101,Erken",
    "Veli,2025-10-17,10:00,12:00,TX-202,Kısa"
  ].join("\n")

const parseCSV = (text: string): Shift[] => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return []
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase())
  const indexOf = (key: string) => headers.indexOf(key)
  const required = ["driver", "date", "start", "end"]
  if (!required.every((key) => indexOf(key) >= 0)) {
    throw new Error("Başlıklar eksik. Gerekli: driver,date,start,end")
  }

  const rows: Shift[] = []
  for (let i = 1; i < lines.length; i++) {
    const columns = splitCSVLine(lines[i])
    if (!columns.length) continue
    const get = (key: string) => columns[indexOf(key)]?.trim() || ""
    const row: Shift = {
      driver: get("driver"),
      date: normalizeDate(get("date")),
      start: normalizeTime(get("start")),
      end: normalizeTime(get("end")),
      vehicle: indexOf("vehicle") >= 0 ? get("vehicle") : undefined,
      note: indexOf("note") >= 0 ? get("note") : undefined
    }
    if (row.driver && row.date && row.start && row.end) rows.push(row)
  }
  return rows
}

const filteredRows = (): Shift[] => {
  const query = state.query.toLowerCase()
  if (!query) return state.rows
  return state.rows.filter((row) =>
    row.driver.toLowerCase().includes(query) ||
    row.date.includes(query) ||
    (row.vehicle || "").toLowerCase().includes(query) ||
    (row.note || "").toLowerCase().includes(query)
  )
}

const render = () => {
  const root = document.getElementById("schedTable")
  const info = document.getElementById("schedInfo")
  if (!root || !info) return

  const rows = filteredRows()
  info.textContent = `Toplam: ${state.stats.total} | Sürücü: ${state.stats.drivers} | Gün: ${state.stats.days} | Çakışma: ${state.stats.conflicts}`
  const body = rows
    .map((row) => {
      const statusBadge = row.conflict
        ? '<span class="badge badge-error">Çakışma</span>'
        : '<span class="badge badge-success">OK</span>'
      const conflictClass = row.conflict
        ? "bg-rose-50/70 dark:bg-rose-900/20"
        : "bg-white dark:bg-gray-900"
      return `
        <tr class="${conflictClass} border-b dark:border-gray-800">
          <td class="px-4 py-2">${row.driver}</td>
          <td class="px-4 py-2">${row.date}</td>
          <td class="px-4 py-2">${row.start}–${row.end}</td>
          <td class="px-4 py-2">${row.vehicle || "-"}</td>
          <td class="px-4 py-2">${row.note || "-"}</td>
          <td class="px-4 py-2 text-right">${statusBadge}</td>
        </tr>`
    })
    .join("")

  root.innerHTML = `
    <div class="relative overflow-x-auto">
      <table class="w-full text-sm text-left rtl:text-right text-gray-600 dark:text-gray-300">
        <thead class="text-xs uppercase bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <tr>
            <th class="px-4 py-3">Sürücü</th>
            <th class="px-4 py-3">Tarih</th>
            <th class="px-4 py-3">Saat</th>
            <th class="px-4 py-3">Araç</th>
            <th class="px-4 py-3">Not</th>
            <th class="px-4 py-3 text-right">Durum</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`
}

export const initSchedule = () => {
  const upload = document.getElementById("schedFile") as HTMLInputElement | null
  const search = document.getElementById("schedQuery") as HTMLInputElement | null
  const loadSample = document.getElementById("schedSample")
  const clearBtn = document.getElementById("schedClear")
  const exportBtn = document.getElementById("schedExport")

  search?.addEventListener("input", () => {
    state.query = search.value
    render()
  })

  loadSample?.addEventListener("click", () => {
    try {
      const rows = parseCSV(sampleCSV())
      state.rows = detectConflicts(rows)
      rebuildStats(state.rows)
      render()
    } catch (error: any) {
      alert(error?.message || "CSV hatası")
    }
  })

  clearBtn?.addEventListener("click", () => {
    state.rows = []
    rebuildStats(state.rows)
    state.stats.conflicts = 0
    render()
  })

  exportBtn?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.rows, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "dienstplan.json"
    anchor.click()
    URL.revokeObjectURL(url)
  })

  upload?.addEventListener("change", async () => {
    const file = upload.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const rows = parseCSV(text)
      state.rows = detectConflicts(rows)
      rebuildStats(state.rows)
      render()
    } catch (error: any) {
      alert(error?.message || "CSV hatası")
    } finally {
      upload.value = ""
    }
  })

  rebuildStats(state.rows)
  state.stats.conflicts = 0
  render()
}
