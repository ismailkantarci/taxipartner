# Tenant Domain Enhancements

## Error Code Reference

| Code | Description | Suggested UI Message |
|------|-------------|----------------------|
| `TENANT_ID_REQUIRED` | Tenant context missing in request | Prompt the user to select an active tenant before repeating the action. |
| `OU_NAME_REQUIRED` | Organizational unit name was not provided | Ask the user to enter a name for the unit. |
| `OU_PARENT_INVALID` | Parent OU does not belong to the tenant | Ask the user to pick a valid parent from the hierarchy. |
| `OU_DELETE_HAS_CHILDREN` | Attempt to delete an OU that still has children | Ask the user to reassign or delete child units before retrying. |
| `OU_NOT_FOUND` | OU could not be loaded | Inform the user that the unit might have been removed. |
| `ORG_NAME_REQUIRED` | Organization name missing | Ask for a valid organization name. |
| `ORG_PARENT_INVALID` | Selected parent organization invalid | Remind the user to pick a parent from the tenant tree. |
| `ORG_COMPANY_INVALID` | Company ID not in tenant scope | Ensure the company exists inside the selected tenant. |
| `ORG_DELETE_HAS_CHILDREN` | Organization has children attached | Ask to remove child orgs before deleting. |
| `ORG_DELETE_HAS_MANDATES` | Organization has mandates attached | Ask to reassign or delete mandates first. |
| `ORG_NOT_FOUND` | Organization missing | Inform the user that the record may have been deleted. |
| `MANDATE_TITLE_REQUIRED` | Mandate title missing | Ask for a descriptive mandate title. |
| `MANDATE_TYPE_REQUIRED` | Mandate type missing | Ask the user to provide a mandate type. |
| `MANDATE_ORG_INVALID` | Organization reference invalid | Ensure the selected organization belongs to the tenant. |
| `MANDATE_COMPANY_INVALID` | Company reference invalid | Ensure the company belongs to the tenant. |
| `MANDATE_NOT_FOUND` | Mandate missing | Inform the user that the record may have been removed. |

## metaJson Guidance

Both **Organization** and **Mandate** models accept a `metaJson` string. Clients should:

- Persist JSON objects as strings (e.g. `{ "tags": ["holding", "compliance"] }`).
- Keep payloads under 4 KB to avoid request bloat.
- Store only attribute-level metadata (labels, color codes, custom IDs). For audit trails, rely on `EntityStatusEvent`.
- Use snake_case keys to stay consistent across modules.

### Example payloads

```json
{
  "tags": ["holding", "group"],
  "contact": {
    "name": "Group Services GmbH",
    "email": "org-admin@example.com"
  }
}
```

```json
{
  "documentRef": "MANDATE-2025-0004",
  "scope": "Personenbeförderung",
  "notes": ["Erstbewilligung", "Wiederkehrende Prüfung"]
}
```

## Next Iteration Roadmap

### Organizations & Org Units

1. **Tree View & Inline Editing**  
   - Integrate a collapsible tree component (TanStack Tree or custom) to visualise hierarchy.  
   - Support drag-and-drop reparenting with optimistic rollback on failure.  
   - Surface quick actions (rename, add child, archive) in a context menu.

2. **Bulk Import / Export**  
   - Define CSV schema (`name,parentId,companyId,orgType,status`).  
   - Implement preview + validation endpoint to highlight orphan parents or invalid companies.  
   - Provide export with depth info for round-trip edits.

3. **A11y & UX Polish**  
   - Add keyboard shortcuts for navigation (↑/↓ to traverse, Enter to focus detail).  
   - Surface breadcrumb path in detail card.  
   - Track hierarchy depth metrics in telemetry (`org_tree_depth`, `org_nodes_total`).

### Mandates

1. **Lifecycle Visualisation**  
   - Add timeline chips for `validFrom`/`validTo` and status changes.  
   - Highlight expired or soon-to-expire mandates.  
   - Hook into notification service for renewal reminders.

2. **Document Binding**  
   - Link `mandateId` to attachment service (upload/list).  
   - Expose `metaJson` from attachments to display permit numbers or issue authority.

### Vehicles

1. **Status History Drawer**  
   - Query `EntityStatusEvent` and show chronological status changes with notes.  
   - Provide filters (last 30 days, by status).  
   - Allow exporting status log as CSV.

2. **Bulk State Update**  
   - Introduce `/tenants/:id/vehicles/bulk-status` endpoint supporting VIN list + target status + optional note.  
   - UI: multi-select list rows, choose status, preview affected vehicles, confirm.

3. **Telemetry & Monitoring**  
   - Emit analytics events (`vehicle_status_update`, `vehicle_archive`) with tenant/company context.  
   - Set up Grafana panel tracking active vs archived vehicles per tenant.
