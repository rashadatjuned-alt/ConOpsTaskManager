import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────
export type EventKey =
  | 'task_assigned'
  | 'subtask_assigned'
  | 'task_unassigned'
  | 'task_status_changed'
  | 'task_completed'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_created'
  | 'project_milestone'
  | 'user_joined'
  | 'password_reset_sent'

interface NotifyPayload {
  eventKey: EventKey
  triggeredBy?: string          // user id who caused the event
  targetUserIds: string[]       // who to notify
  entityType?: string
  entityId?: string
  entityName?: string
  message: string
}

// ── Core send function ─────────────────────────────────────
export async function sendNotification(payload: NotifyPayload) {
  // 1. Check if this event is enabled in config
  const { data: config } = await supabase
    .from('NotificationConfig')
    .select('*')
    .eq('event_key', payload.eventKey)
    .eq('enabled', true)
    .single()

  if (!config) return  // event disabled globally

  // 2. Get roles of target users
  const { data: users } = await supabase
    .from('Users')
    .select('id, role')
    .in('id', payload.targetUserIds)

  if (!users?.length) return

  // 3. Filter by role config
  const eligible = users.filter((u: any) => {
    if (u.role === 'Team Member') return config.team_member
    if (u.role === 'Manager')     return config.manager
    if (u.role === 'Admin')       return config.manager  // admins use manager settings
    return false
  })

  if (!eligible.length) return

  // 4. Insert notifications + activity log
  const now = new Date().toISOString()

  for (const user of eligible) {
    // In-app notification
    await supabase.from('Notifications').insert({
      user_id: user.id,
      message: payload.message,
      is_read: false,
    })

    // Activity log
    await supabase.from('NotificationActivity').insert({
      event_key:      payload.eventKey,
      triggered_by:   payload.triggeredBy || null,
      target_user_id: user.id,
      entity_type:    payload.entityType || null,
      entity_id:      payload.entityId ? String(payload.entityId) : null,
      entity_name:    payload.entityName || null,
      message:        payload.message,
      created_at:     now,
    })
  }
}

// ── Helper: get deadline_days config ───────────────────────
export async function getDeadlineDays(): Promise<number> {
  const { data } = await supabase
    .from('NotificationConfig')
    .select('deadline_days')
    .eq('event_key', 'task_due_soon')
    .single()
  return data?.deadline_days ?? 2
}

// ── Convenience functions ──────────────────────────────────

export async function notifyTaskAssigned(
  taskId: string, taskName: string,
  projectName: string, assigneeIds: string[], triggeredBy?: string
) {
  if (!assigneeIds.length) return
  await sendNotification({
    eventKey: 'task_assigned',
    triggeredBy,
    targetUserIds: assigneeIds,
    entityType: 'task', entityId: taskId, entityName: taskName,
    message: `You were assigned to task "${taskName}"${projectName ? ` in ${projectName}` : ''}.`,
  })
}

export async function notifySubtaskAssigned(
  taskId: string, subtaskName: string,
  taskName: string, assigneeIds: string[], triggeredBy?: string
) {
  if (!assigneeIds.length) return
  await sendNotification({
    eventKey: 'subtask_assigned',
    triggeredBy,
    targetUserIds: assigneeIds,
    entityType: 'subtask', entityId: taskId, entityName: subtaskName,
    message: `You were assigned to subtask "${subtaskName}" under "${taskName}".`,
  })
}

export async function notifyTaskUnassigned(
  taskId: string, taskName: string,
  removedUserIds: string[], triggeredBy?: string
) {
  if (!removedUserIds.length) return
  await sendNotification({
    eventKey: 'task_unassigned',
    triggeredBy,
    targetUserIds: removedUserIds,
    entityType: 'task', entityId: taskId, entityName: taskName,
    message: `You were removed from task "${taskName}".`,
  })
}

export async function notifyTaskStatusChanged(
  taskId: string, taskName: string,
  newStatus: string, assigneeIds: string[],
  projectName: string, triggeredBy?: string
) {
  if (!assigneeIds.length) return

  // Also notify managers of the project
  const { data: managers } = await supabase
    .from('Users').select('id').eq('role', 'Manager')
  const managerIds = (managers || []).map((u: any) => u.id)
  const allIds = [...new Set([...assigneeIds, ...managerIds])]

  await sendNotification({
    eventKey: 'task_status_changed',
    triggeredBy,
    targetUserIds: allIds,
    entityType: 'task', entityId: taskId, entityName: taskName,
    message: `Task "${taskName}" status changed to "${newStatus}"${projectName ? ` in ${projectName}` : ''}.`,
  })
}

export async function notifyTaskCompleted(
  taskId: string, taskName: string,
  projectName: string, triggeredBy?: string
) {
  // Notify all managers
  const { data: managers } = await supabase
    .from('Users').select('id').in('role', ['Manager', 'Admin'])
  const ids = (managers || []).map((u: any) => u.id)
  if (!ids.length) return
  await sendNotification({
    eventKey: 'task_completed',
    triggeredBy,
    targetUserIds: ids,
    entityType: 'task', entityId: taskId, entityName: taskName,
    message: `Task "${taskName}" was marked Completed${projectName ? ` in ${projectName}` : ''}.`,
  })
}

export async function notifyTaskCreated(
  taskId: string, taskName: string,
  projectName: string, triggeredBy?: string
) {
  // Notify all managers
  const { data: managers } = await supabase
    .from('Users').select('id').in('role', ['Manager', 'Admin'])
  const ids = (managers || []).map((u: any) => u.id)
  if (!ids.length) return
  await sendNotification({
    eventKey: 'task_created',
    triggeredBy,
    targetUserIds: ids,
    entityType: 'task', entityId: taskId, entityName: taskName,
    message: `New task "${taskName}" was created${projectName ? ` in ${projectName}` : ''}.`,
  })
}

export async function notifyUserJoined(
  newUserName: string, newUserEmail: string
) {
  const { data: managers } = await supabase
    .from('Users').select('id').in('role', ['Manager', 'Admin'])
  const ids = (managers || []).map((u: any) => u.id)
  if (!ids.length) return
  await sendNotification({
    eventKey: 'user_joined',
    targetUserIds: ids,
    entityType: 'user', entityName: newUserName,
    message: `New user "${newUserName}" (${newUserEmail}) joined the system.`,
  })
}

export async function notifyPasswordResetSent(
  targetUserId: string, targetUserName: string
) {
  await sendNotification({
    eventKey: 'password_reset_sent',
    targetUserIds: [targetUserId],
    entityType: 'user', entityName: targetUserName,
    message: `A password reset link has been sent to your email.`,
  })
}

export async function notifyProjectMilestone(
  projectName: string, milestone: number
) {
  const { data: managers } = await supabase
    .from('Users').select('id').in('role', ['Manager', 'Admin'])
  const ids = (managers || []).map((u: any) => u.id)
  if (!ids.length) return
  await sendNotification({
    eventKey: 'project_milestone',
    targetUserIds: ids,
    entityType: 'project', entityName: projectName,
    message: `Project "${projectName}" has reached ${milestone}% completion! 🎉`,
  })
}

// ── Due soon checker (call this from a scheduled check or page load) ──
export async function checkDueSoonTasks() {
  const deadlineDays = await getDeadlineDays()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const cutoff = new Date(today.getTime() + deadlineDays * 864e5)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const { data: tasks } = await supabase
    .from('Tasks')
    .select('*')
    .neq('status', 'Completed')
    .gte('end_date', todayStr)
    .lte('end_date', cutoffStr)

  for (const task of tasks || []) {
    const assignees: string[] = Array.isArray(task.assignees) && task.assignees.length
      ? task.assignees
      : task.owner ? [task.owner] : []

    if (!assignees.length) continue

    // Get user IDs for assignees by name
    const { data: users } = await supabase
      .from('Users').select('id, full_name').in('full_name', assignees)
    const ids = (users || []).map((u: any) => u.id)
    if (!ids.length) continue

    await sendNotification({
      eventKey: 'task_due_soon',
      targetUserIds: ids,
      entityType: 'task', entityId: task.id, entityName: task.topic,
      message: `Task "${task.topic}" is due on ${task.end_date} (in ${deadlineDays} day${deadlineDays !== 1 ? 's' : ''}).`,
    })
  }
}
