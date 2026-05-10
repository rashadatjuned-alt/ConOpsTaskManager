// ════════════════════════════════════════════════════════
// SHARED HELPER — save this as lib/projectUtils.ts
// ════════════════════════════════════════════════════════

export function getAssignees(row: any): string[] {
  if (Array.isArray(row?.assignees) && row.assignees.length > 0) return row.assignees
  if (row?.owner) return row.owner.split(',').map((s: string) => s.trim()).filter(Boolean)
  return []
}
