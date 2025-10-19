import "./style.css"
import "flowbite"
import "preline"
import { initWizard } from "./wizard"
import { initTable } from "./table"
import { initInvoice } from "./invoice"
import { initRBAC } from "./rbac"
import { initSchedule } from "./schedule"

const root = document.documentElement
const stored = localStorage.getItem("theme")
if (stored === "dark") root.classList.add("dark")

function setTenant(name: string) {
  const buttonLbl = document.getElementById("tenantCurrentBtn")
  if (buttonLbl) buttonLbl.textContent = name
  const asideLbl = document.getElementById("tenantCurrentLabel")
  if (asideLbl) asideLbl.textContent = name
  localStorage.setItem("tenant", name)
}

document.addEventListener("DOMContentLoaded", () => {
  // theme
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    root.classList.toggle("dark")
    localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light")
  })

  // tenant init
  const saved = localStorage.getItem("tenant") || "Reftiss KG"
  setTenant(saved)

  // tenant click handlers
  document.querySelectorAll<HTMLButtonElement>("[data-tenant-name]").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.tenantName!
      setTenant(name)
      // dropdown auto-close handled by Flowbite; but ensure blur:
      btn.blur()
    })
  })

  // simple filter
  const filter = document.getElementById("tenantFilter") as HTMLInputElement | null
  if (filter) {
    filter.addEventListener("input", () => {
      const q = filter.value.toLowerCase()
      document.querySelectorAll<HTMLLIElement>("#tenantList li").forEach(li => {
        const n = li.textContent?.toLowerCase() || ""
        li.classList.toggle("hidden", !n.includes(q))
      })
    })
  }
  initWizard()
  initTable()
  try {
    initInvoice()
  } catch (error) {
    console.error("[invoice] init hatası:", error)
  }

  try {
    initRBAC()
  } catch (error) {
    console.error("[rbac] init hatası:", error)
  }

  try {
    initSchedule()
  } catch (error) {
    console.error("[schedule] init hatası:", error)
  }
})
