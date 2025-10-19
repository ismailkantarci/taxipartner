import { z, type ZodIssue } from "zod"

const companySchema = z.object({
  name: z.string().min(2, "Şirket adı zorunlu"),
  uid: z.string().regex(/^ATU[0-9]{8}$/i, "UID formatı ATU######## olmalı"),
  street: z.string().min(2, "Sokak zorunlu"),
  city: z.string().min(2, "Şehir zorunlu"),
  zip: z.string().min(3, "PLZ zorunlu")
})

type Company = z.infer<typeof companySchema>

const setStepVisibility = (step: number) => {
  document.querySelectorAll<HTMLElement>("[data-step]").forEach((el) => {
    el.classList.toggle("hidden", Number(el.dataset.step) !== step)
  })
  document.querySelectorAll<HTMLElement>("[data-step-dot]").forEach((dot, index) => {
    dot.classList.toggle("bg-brand-500", index + 1 <= step)
  })
}

const readFormValue = (id: string) =>
  (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() ?? ""

const collectFormValues = (): Company => ({
  name: readFormValue("w_name"),
  uid: readFormValue("w_uid").toUpperCase(),
  street: readFormValue("w_street"),
  city: readFormValue("w_city"),
  zip: readFormValue("w_zip")
})

const setFieldError = (id: string, message?: string) => {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = message ?? ""
  el.classList.toggle("hidden", !message)
}

const renderSummary = (company: Company) => {
  const summary = document.getElementById("w_summary")
  if (!summary) return
  summary.innerHTML = `
    <div class="space-y-1 text-sm">
      <div><span class="opacity-70">Ad:</span> <strong>${company.name}</strong></div>
      <div><span class="opacity-70">UID:</span> <strong>${company.uid}</strong></div>
      <div><span class="opacity-70">Adres:</span> <strong>${company.street}, ${company.zip} ${company.city}</strong></div>
    </div>`
}

export const initWizard = () => {
  let step = 1
  const errorIds = ["err_name", "err_uid", "err_street", "err_city", "err_zip"]

  const modal = document.getElementById("w_modal")
  let lastTrigger: HTMLElement | null = null

  const openModal = (trigger?: HTMLElement) => {
    if (!modal) return
    lastTrigger = trigger ?? lastTrigger
    modal.classList.remove("hidden")
    modal.setAttribute("aria-hidden", "false")
    modal.focus()
    goToStep(1)
    const firstInput = modal.querySelector<HTMLInputElement>("#w_name")
    window.setTimeout(() => firstInput?.focus(), 0)
  }

  const closeModal = () => {
    if (!modal) return
    const activeElement = document.activeElement as HTMLElement | null
    if (activeElement && modal.contains(activeElement)) {
      activeElement.blur()
    }
    modal.setAttribute("aria-hidden", "true")
    modal.classList.add("hidden")
    lastTrigger?.focus?.()
  }

  const goToStep = (next: number) => {
    step = Math.min(Math.max(next, 1), 4)
    setStepVisibility(step)
  }

  goToStep(step)

  document.getElementById("w_next")?.addEventListener("click", () => {
    const data = collectFormValues()
    errorIds.forEach((id) => setFieldError(id))

    try {
      if (step === 1) {
        z.object({ name: companySchema.shape.name }).parse({ name: data.name })
      } else if (step === 2) {
        z.object({ uid: companySchema.shape.uid }).parse({ uid: data.uid })
      } else if (step === 3) {
        z
          .object({
            street: companySchema.shape.street,
            city: companySchema.shape.city,
            zip: companySchema.shape.zip
          })
          .parse({ street: data.street, city: data.city, zip: data.zip })
        renderSummary(data)
      }
      goToStep(step + 1)
    } catch (error) {
      const issues = (error as { issues?: ZodIssue[] })?.issues
      issues?.forEach((issue: ZodIssue) => {
        const key = issue.path[0]
        if (typeof key === "string") {
          setFieldError(`err_${key}`, issue.message)
        }
      })
    }
  })

  document.getElementById("w_prev")?.addEventListener("click", () => {
    goToStep(step - 1)
  })

  document.getElementById("w_save")?.addEventListener("click", () => {
    const parsed = companySchema.safeParse(collectFormValues())
    if (!parsed.success) {
      parsed.error.issues.forEach((issue: ZodIssue) => {
        const key = issue.path[0]
        if (typeof key === "string") {
          setFieldError(`err_${key}`, issue.message)
        }
      })
      return
    }

    console.log("Company saved:", parsed.data)
    closeModal()
  })

  document.querySelectorAll<HTMLElement>("[data-wizard-open]").forEach((button) => {
    button.addEventListener("click", () => openModal(button))
  })

  document.querySelectorAll<HTMLElement>("[data-wizard-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal())
  })
}
