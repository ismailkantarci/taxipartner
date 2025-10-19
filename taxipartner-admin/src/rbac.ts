type Perm = "read" | "create" | "update" | "delete"
type Resource = "Company" | "Vehicle" | "Driver" | "Invoice" | "GISA" | "User" | "Role"
type Role = "SuperAdmin" | "Manager" | "Accountant" | "Inspector" | "Driver"

const ROLES: Role[] = ["SuperAdmin", "Manager", "Accountant", "Inspector", "Driver"]
const RESOURCES: Resource[] = ["Company", "Vehicle", "Driver", "Invoice", "GISA", "User", "Role"]
const PERMISSIONS: Perm[] = ["read", "create", "update", "delete"]

type Matrix = Record<Role, Record<Resource, Record<Perm, boolean>>>

const buildDefaultMatrix = (): Matrix => {
  const matrix: Matrix = {} as Matrix

  ROLES.forEach((role) => {
    matrix[role] = {} as Matrix[Role]
    RESOURCES.forEach((resource) => {
      matrix[role][resource] = { read: false, create: false, update: false, delete: false }
    })
  })

  RESOURCES.forEach((resource) => {
    PERMISSIONS.forEach((permission) => {
      matrix.SuperAdmin[resource][permission] = true
    })
  })

  const managerResources: Resource[] = ["Company", "Vehicle", "Driver", "Invoice", "GISA"]
  managerResources.forEach((resource) => {
    matrix.Manager[resource].read = true
    matrix.Manager[resource].update = true
    if (!["Role", "User"].includes(resource)) {
      matrix.Manager[resource].create = true
    }
  })

  matrix.Accountant.Invoice.read = true
  matrix.Accountant.Invoice.update = true

  RESOURCES.forEach((resource) => {
    matrix.Inspector[resource].read = true
  })

  matrix.Driver.Driver.read = true
  matrix.Driver.Invoice.create = true

  return matrix
}

let matrix: Matrix = (() => {
  try {
    const raw = localStorage.getItem("rbac")
    if (raw) return JSON.parse(raw) as Matrix
  } catch (error) {
    console.warn("[rbac] stored matrix parse error", error)
  }
  return buildDefaultMatrix()
})()

const cellId = (role: Role, resource: Resource, permission: Perm) => `rb_${role}_${resource}_${permission}`

const persistMatrix = () => {
  localStorage.setItem("rbac", JSON.stringify(matrix))
  const output = document.getElementById("rbacJson")
  if (output) output.textContent = JSON.stringify(matrix, null, 2)
}

const setCellValue = (role: Role, resource: Resource, permission: Perm, value: boolean) => {
  matrix[role][resource][permission] = value
  const element = document.getElementById(cellId(role, resource, permission)) as HTMLInputElement | null
  if (element) element.checked = value
}

const toggleRoleRow = (role: Role, value: boolean) => {
  RESOURCES.forEach((resource) => {
    PERMISSIONS.forEach((permission) => {
      setCellValue(role, resource, permission, value)
    })
  })
}

const toggleResourceColumn = (resource: Resource, permission: Perm, value: boolean) => {
  ROLES.forEach((role) => setCellValue(role, resource, permission, value))
}

const roleHasAllPermissions = (role: Role) =>
  RESOURCES.every((resource) => PERMISSIONS.every((permission) => matrix[role][resource][permission]))

const columnHasAllPermissions = (resource: Resource, permission: Perm) =>
  ROLES.every((role) => matrix[role][resource][permission])

const renderMatrix = () => {
  const container = document.getElementById("rbacMatrix")
  if (!container) return

  const query = (document.getElementById("rbacFilter") as HTMLInputElement | null)?.value?.toLowerCase() ?? ""

  const headerHtml = `
    <thead class="text-xs uppercase bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
      <tr>
        <th class="w-40 px-4 py-3">Role</th>
        ${RESOURCES.map(
          (resource) => `
            <th class="px-2 py-3 text-center">
              <div class="text-xs font-medium">${resource}</div>
              <div class="mt-1 flex items-center justify-center gap-2">
                ${PERMISSIONS.map(
                  (permission) => `
                    <label class="inline-flex items-center gap-1 text-[11px]">
                      <input
                        id="col_${resource}_${permission}"
                        type="checkbox"
                        class="checkbox checkbox-xs"
                        ${columnHasAllPermissions(resource, permission) ? "checked" : ""}
                      />
                      <span>${permission[0].toUpperCase()}</span>
                    </label>`
                ).join("")}
              </div>
            </th>`
        ).join("")}
      </tr>
    </thead>`

  const bodyHtml = ROLES.filter((role) => !query || role.toLowerCase().includes(query))
    .map(
      (role) => `
        <tr class="bg-white dark:bg-gray-900 border-b dark:border-gray-800">
          <th scope="row" class="px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="font-medium">${role}</span>
              <label class="ml-2 inline-flex items-center gap-1 text-[11px]">
                <input
                  id="row_${role}"
                  type="checkbox"
                  class="checkbox checkbox-xs"
                  ${roleHasAllPermissions(role) ? "checked" : ""}
                />
                <span>Tümü</span>
              </label>
            </div>
          </th>
          ${RESOURCES.map(
            (resource) => `
              <td class="px-2 py-2">
                <div class="grid grid-cols-4 place-items-center gap-1">
                  ${PERMISSIONS.map(
                    (permission) => `
                      <input
                        id="${cellId(role, resource, permission)}"
                        type="checkbox"
                        class="checkbox checkbox-xs"
                        data-role="${role}"
                        data-resource="${resource}"
                        data-permission="${permission}"
                        ${matrix[role][resource][permission] ? "checked" : ""}
                      />`
                  ).join("")}
                </div>
              </td>`
          ).join("")}
        </tr>`
    )
    .join("")

  container.innerHTML = `
    <div class="relative overflow-x-auto">
      <table class="w-full text-sm text-left rtl:text-right text-gray-600 dark:text-gray-300">
        ${headerHtml}
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>`

  container.querySelectorAll<HTMLInputElement>("input[data-role]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const role = checkbox.dataset.role as Role
      const resource = checkbox.dataset.resource as Resource
      const permission = checkbox.dataset.permission as Perm
      matrix[role][resource][permission] = checkbox.checked
      persistMatrix()

      const columnCheckbox = document.getElementById(`col_${resource}_${permission}`) as HTMLInputElement | null
      if (columnCheckbox) columnCheckbox.checked = columnHasAllPermissions(resource, permission)

      const rowCheckbox = document.getElementById(`row_${role}`) as HTMLInputElement | null
      if (rowCheckbox) rowCheckbox.checked = roleHasAllPermissions(role)
    })
  })

  container.querySelectorAll<HTMLInputElement>("input[id^='row_']").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const role = checkbox.id.replace("row_", "") as Role
      toggleRoleRow(role, checkbox.checked)
      persistMatrix()
      renderMatrix()
    })
  })

  container.querySelectorAll<HTMLInputElement>("input[id^='col_']").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const [, resource, permission] = checkbox.id.split("_") as [string, Resource, Perm]
      toggleResourceColumn(resource, permission, checkbox.checked)
      persistMatrix()
      renderMatrix()
    })
  })
}

export const initRBAC = () => {
  const exportButton = document.getElementById("rbacExport")
  exportButton?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(matrix, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "rbac.json"
    anchor.click()
    URL.revokeObjectURL(url)
  })

  const clearButton = document.getElementById("rbacClear")
  clearButton?.addEventListener("click", () => {
    matrix = buildDefaultMatrix()
    persistMatrix()
    renderMatrix()
  })

  const filterInput = document.getElementById("rbacFilter") as HTMLInputElement | null
  filterInput?.addEventListener("input", () => renderMatrix())

  renderMatrix()
  const output = document.getElementById("rbacJson")
  if (output) output.textContent = JSON.stringify(matrix, null, 2)
}
