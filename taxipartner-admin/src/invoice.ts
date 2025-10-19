type OCRRaw = Record<string, any>
type MappingKey = "date" | "amount" | "vendor" | "invoiceNo"

const SAMPLE: OCRRaw = {
  vendor: "Shell Wien Mitte",
  invoiceNo: "RE-2025-00123",
  date: "2025-10-16",
  amount: 82.45,
  vat: 13.74,
  currency: "EUR",
  items: [{ name: "Super 95", qty: 34.2, unit: "L", price: 2.41, sum: 82.45 }]
}

const qs = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)

const renderJSON = (input: unknown, target: HTMLElement) => {
  target.textContent = JSON.stringify(input, null, 2)
}

const collectMapping = (): Record<MappingKey, string> => {
  const keys: MappingKey[] = ["date", "amount", "vendor", "invoiceNo"]
  return keys.reduce<Record<MappingKey, string>>((acc, key) => {
    const select = document.getElementById(`map_${key}`) as HTMLSelectElement | null
    acc[key] = select?.value ?? ""
    return acc
  }, {} as Record<MappingKey, string>)
}

const flatten = (input: unknown, prefix = ""): Record<string, string> => {
  const output: Record<string, string> = {}

  if (!input || typeof input !== "object") {
    return output
  }

  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(output, flatten(value, path))
    } else {
      output[path] = String(value ?? "")
    }
  })

  return output
}

const fillMappingOptions = (raw: OCRRaw) => {
  const flat = flatten(raw)
  const options = Object.keys(flat)
    .map((path) => `<option value="${path}">${path}</option>`)
    .join("")

  const setOptions = (key: MappingKey) => {
    const select = document.getElementById(`map_${key}`) as HTMLSelectElement | null
    if (!select) return
    select.innerHTML = `<option value="">—</option>${options}`
  }

  ;(["date", "amount", "vendor", "invoiceNo"] as MappingKey[]).forEach(setOptions)

  const tryDefaults = (id: string, candidates: string[]) => {
    const select = document.getElementById(id) as HTMLSelectElement | null
    if (!select) return
    const match = candidates.find((candidate) => flat[candidate] !== undefined)
    if (match) select.value = match
  }

  tryDefaults("map_date", ["date", "invoice.date", "createdAt"])
  tryDefaults("map_amount", ["amount", "total", "grandTotal"])
  tryDefaults("map_vendor", ["vendor", "merchant", "supplier", "company"])
  tryDefaults("map_invoiceNo", ["invoiceNo", "invoice", "number"])
}

const applyMapping = (raw: OCRRaw, map: Record<MappingKey, string>) => {
  const flat = flatten(raw)
  const read = (path?: string) => (path ? flat[path] ?? "" : "")

  return {
    date: read(map.date),
    amount: Number(read(map.amount) || 0),
    vendor: read(map.vendor),
    invoiceNo: read(map.invoiceNo),
    currency: raw.currency ?? "EUR"
  }
}

let invoiceLastTrigger: HTMLElement | null = null

const openDrawer = (trigger?: HTMLElement) => {
  const drawer = qs<HTMLDivElement>("#invoiceDrawer")
  if (!drawer) return
  invoiceLastTrigger = trigger ?? invoiceLastTrigger
  drawer.classList.remove("hidden", "translate-x-full")
  drawer.setAttribute("aria-hidden", "false")
  const closeButton = drawer.querySelector<HTMLElement>("[data-invoice-close]")
  closeButton?.focus()
}

const closeDrawer = () => {
  const drawer = qs<HTMLDivElement>("#invoiceDrawer")
  if (!drawer) return
  drawer.classList.add("translate-x-full")
  const active = document.activeElement as HTMLElement | null
  if (active && drawer.contains(active)) {
    active.blur()
  }
  window.setTimeout(() => {
    drawer.classList.add("hidden")
    drawer.setAttribute("aria-hidden", "true")
    invoiceLastTrigger?.focus?.()
  }, 150)
}

export const initInvoice = () => {
  const rawOutput = qs<HTMLPreElement>("#ocrRaw")
  const mappedOutput = qs<HTMLPreElement>("#mappedJson")
  const fileInput = qs<HTMLInputElement>("#invoiceFile")
  const simulateButton = qs<HTMLButtonElement>("#simulateOCR")
  const applyButton = qs<HTMLButtonElement>("#applyMapping")

  if (!rawOutput || !mappedOutput || !fileInput || !simulateButton || !applyButton) {
    return
  }

  let raw: OCRRaw = {}

  document
    .querySelectorAll<HTMLElement>("[data-invoice-open]")
    .forEach((button) =>
      button.addEventListener("click", () => openDrawer(button))
    )

  document
    .querySelectorAll<HTMLElement>("[data-invoice-close]")
    .forEach((button) => button.addEventListener("click", () => closeDrawer()))

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0]
    if (!file) return

    if (file.type === "application/json" || file.name.endsWith(".json")) {
      try {
        raw = JSON.parse(await file.text())
      } catch (error) {
        raw = { error: "Geçersiz JSON", detail: String(error) }
      }
    } else {
      const baseName = file.name.replace(/\.[^.]+$/, "")
      raw = { ...SAMPLE, invoiceNo: `RE-${baseName.toUpperCase()}` }
    }

    renderJSON(raw, rawOutput)
    fillMappingOptions(raw)
    mappedOutput.textContent = ""
  })

  simulateButton.addEventListener("click", () => {
    raw = structuredClone(SAMPLE)
    renderJSON(raw, rawOutput)
    fillMappingOptions(raw)
    mappedOutput.textContent = ""
  })

  applyButton.addEventListener("click", () => {
    if (!raw || !Object.keys(raw).length) {
      alert("Önce dosya yükle veya OCR simüle et.")
      return
    }

    const mapping = collectMapping()
    const result = applyMapping(raw, mapping)
    renderJSON(result, mappedOutput)
  })
}
