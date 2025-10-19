type Status = "Aktif" | "Beklemede" | "Pasif"
type CompanyRow = { id: number; name: string; uid: string; status: Status }

const DATA: CompanyRow[] = Array.from({ length: 57 }, (_, i) => {
  const n = i + 1
  const status: Status = n % 7 === 0 ? "Pasif" : n % 3 === 0 ? "Beklemede" : "Aktif"
  return {
    id: n,
    name: n % 2 ? "Reftiss KG" : "TAXIPartner GmbH",
    uid: `ATU${String(10000000 + n).padStart(8, "0")}`,
    status
  }
})

const state = {
  page: 1,
  pageSize: 10,
  query: ""
}

const statusBadge = (status: Status) => {
  switch (status) {
    case "Aktif":
      return '<span class="badge badge-success">Aktif</span>'
    case "Beklemede":
      return '<span class="badge badge-warning">Beklemede</span>'
    default:
      return '<span class="badge badge-ghost">Pasif</span>'
  }
}

const filteredRows = () => {
  const query = state.query.toLowerCase()
  if (!query) return DATA
  return DATA.filter((row) => {
    const values = [row.name, row.uid, row.status]
    return values.some((value) => value.toLowerCase().includes(query))
  })
}

const getPagedRows = () => {
  const rows = filteredRows()
  const start = (state.page - 1) * state.pageSize
  const end = start + state.pageSize
  return { rows: rows.slice(start, end), total: rows.length }
}

const clampPage = (total: number) => {
  const maxPage = Math.max(1, Math.ceil(total / state.pageSize))
  state.page = Math.min(Math.max(state.page, 1), maxPage)
  return maxPage
}

const renderTable = () => {
  const tableRoot = document.getElementById("companyTable")
  if (!tableRoot) return

  const { rows, total } = getPagedRows()
  const maxPage = clampPage(total)

  const headerHtml = `
    <thead class="text-xs uppercase bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
      <tr>
        <th scope="col" class="px-6 py-3">Ad</th>
        <th scope="col" class="px-6 py-3">UID</th>
        <th scope="col" class="px-6 py-3">Durum</th>
        <th scope="col" class="px-6 py-3 text-right">İşlem</th>
      </tr>
    </thead>`

  const bodyHtml = rows
    .map(
      (row) => `
        <tr class="bg-white dark:bg-gray-900 border-b dark:border-gray-800">
          <th scope="row" class="px-6 py-4 font-medium whitespace-nowrap">${row.name}</th>
          <td class="px-6 py-4">${row.uid}</td>
          <td class="px-6 py-4">${statusBadge(row.status)}</td>
          <td class="px-6 py-4 text-right">
            <div class="join">
              <button class="btn btn-xs join-item" data-row="detail" data-id="${row.id}">Detay</button>
              <button class="btn btn-xs join-item" data-row="edit" data-id="${row.id}">Düzenle</button>
              <button class="btn btn-xs join-item" data-row="delete" data-id="${row.id}">Sil</button>
            </div>
          </td>
        </tr>`
    )
    .join("")

  tableRoot.innerHTML = `
    <div class="relative overflow-x-auto">
      <table class="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
        ${headerHtml}
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>`

  const info = document.getElementById("tblInfo")
  const prevButton = document.getElementById("tblPrev") as HTMLButtonElement | null
  const nextButton = document.getElementById("tblNext") as HTMLButtonElement | null
  const startIndex = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1
  const endIndex = Math.min(state.page * state.pageSize, total)

  if (info) info.textContent = total ? `${startIndex}–${endIndex} / ${total}` : "0 / 0"
  if (prevButton) prevButton.disabled = state.page <= 1
  if (nextButton) nextButton.disabled = state.page >= maxPage

  document.querySelectorAll<HTMLButtonElement>("[data-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id)
      const action = button.dataset.row
      const row = DATA.find((entry) => entry.id === id)
      if (!row || !action) return

      if (action === "detail" || action === "edit") {
        openDrawer(row, action === "edit", button)
      } else if (action === "delete") {
        alert("Demo: Silme işlemi backend bağlı değil.")
      }
    })
  })
}

const bindControls = () => {
  const searchInput = document.getElementById("tblSearch") as HTMLInputElement | null
  const sizeSelect = document.getElementById("tblSize") as HTMLSelectElement | null
  const prevButton = document.getElementById("tblPrev")
  const nextButton = document.getElementById("tblNext")

  searchInput?.addEventListener("input", () => {
    state.query = searchInput.value
    state.page = 1
    renderTable()
  })

  sizeSelect?.addEventListener("change", () => {
    state.pageSize = Number(sizeSelect.value) || 10
    state.page = 1
    renderTable()
  })

  prevButton?.addEventListener("click", () => {
    state.page -= 1
    renderTable()
  })

  nextButton?.addEventListener("click", () => {
    state.page += 1
    renderTable()
  })
}

const detailView = (row: CompanyRow) => `
  <div class="space-y-2 text-sm">
    <div><span class="opacity-70">Ad:</span> <strong>${row.name}</strong></div>
    <div><span class="opacity-70">UID:</span> <strong>${row.uid}</strong></div>
    <div><span class="opacity-70">Durum:</span> ${statusBadge(row.status)}</div>
  </div>`

const editForm = (row: CompanyRow) => `
  <div class="space-y-3">
    <label class="form-control">
      <span class="label-text">Şirket Adı</span>
      <input class="input input-bordered" value="${row.name}" />
    </label>
    <label class="form-control">
      <span class="label-text">UID</span>
      <input class="input input-bordered" value="${row.uid}" />
    </label>
    <label class="form-control">
      <span class="label-text">Durum</span>
      <select class="select select-bordered">
        <option ${row.status === "Aktif" ? "selected" : ""}>Aktif</option>
        <option ${row.status === "Beklemede" ? "selected" : ""}>Beklemede</option>
        <option ${row.status === "Pasif" ? "selected" : ""}>Pasif</option>
      </select>
    </label>
    <div class="flex justify-end">
      <button class="btn btn-primary">Kaydet (Demo)</button>
    </div>
  </div>`

let rowDrawerLastTrigger: HTMLElement | null = null

const openDrawer = (row: CompanyRow, editable: boolean, trigger?: HTMLElement) => {
  const body = document.getElementById("rowDrawerBody")
  if (body) {
    body.innerHTML = editable ? editForm(row) : detailView(row)
  }

  const drawer = document.getElementById("rowDrawer")
  if (drawer) {
    drawer.classList.remove("hidden", "translate-x-full")
    drawer.setAttribute("aria-hidden", "false")
    const closeButton = drawer.querySelector<HTMLElement>("[data-rowdrawer-close]")
    closeButton?.focus()
  }
  rowDrawerLastTrigger = trigger ?? rowDrawerLastTrigger
}

export const initTable = () => {
  bindControls()
  renderTable()

  document.querySelectorAll<HTMLElement>("[data-rowdrawer-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const drawer = document.getElementById("rowDrawer")
      if (!drawer) return
      drawer.classList.add("translate-x-full")
      const active = document.activeElement as HTMLElement | null
      if (active && drawer.contains(active)) {
        active.blur()
      }
      window.setTimeout(() => {
        drawer.classList.add("hidden")
        drawer.setAttribute("aria-hidden", "true")
        rowDrawerLastTrigger?.focus?.()
      }, 150)
    })
  })
}
