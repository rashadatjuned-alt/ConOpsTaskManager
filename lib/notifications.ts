/**
 * lib/notifications.ts
 *
 * Drop-in replacement for your existing file.
 * Changes vs previous version:
 *   1. NotifyPayload now accepts taskId / subtaskId / projectId
 *      → stored on the Notifications row for deep-link routing
 *   2. sendNotification() reads send_email from NotificationConfig
 *      and fires /api/email when true
 *   3. All existing convenience functions updated to pass IDs
 *   4. New: notifyProjectAssigned()
 *
 * Nothing else changed — all existing callers keep working.
 */

import { supabase } from './supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

// ── Types ──────────────────────────────────────────────────────────────────────

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
  | 'project_assigned'
  | 'user_joined'
  | 'password_reset_sent'

interface NotifyPayload {
  eventKey: EventKey
  triggeredBy?: string          // user id who caused the event
  targetUserIds: string[]       // who to notify

  // Deep-link IDs — stored on the Notifications row
  // NotificationModal uses these for direct routing
  taskId?:    number | null     // integer PK of Tasks
  subtaskId?: number | null     // integer PK of Subtasks
  projectId?: string | null     // uuid PK of Projects

  // Activity log fields
  entityType?: string
  entityId?:   string
  entityName?: string

  message: string

  // Email extras — only used when send_email = true for this event
  emailSubject?: string
  emailExtras?: {
    taskName?:    string
    projectName?: string
    dueDate?:     string
    taskUrl?:     string
    subtaskUrl?:  string
    projectUrl?:  string
    commentUrl?:  string    // future: chat/comment deep-link
  }
}

// ── Core send function ─────────────────────────────────────────────────────────

export async function sendNotification(payload: NotifyPayload) {
  // 1. Check if event is enabled in config
  const { data: config } = await supabase
    .from('NotificationConfig')
    .select('*')
    .eq('event_key', payload.eventKey)
    .eq('enabled', true)
    .single()

  if (!config) return   // event disabled globally

  // 2. Get roles + emails of target users
  const { data: users } = await supabase
    .from('Users')
    .select('id, role, email, full_name')
    .in('id', payload.targetUserIds)

  if (!users?.length) return

  // 3. Filter by role config (same logic as before)
  const eligible = users.filter((u: any) => {
    if (u.role === 'Team Member') return config.team_member
    if (u.role === 'Manager')     return config.manager
    if (u.role === 'Admin')       return config.manager  // admins use manager settings
    return false
  })

  if (!eligible.length) return

  const now = new Date().toISOString()

  for (const user of eligible) {
    // 4a. Insert in-app notification WITH deep-link IDs
    await supabase.from('Notifications').insert({
      user_id:    user.id,
      message:    payload.message,
      is_read:    false,
      task_id:    payload.taskId    ?? null,
      subtask_id: payload.subtaskId ?? null,
      project_id: payload.projectId ?? null,
    })

    // 4b. Activity log (unchanged)
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

    // 4c. Send email if configured for this event AND user has an email
    if (config.send_email && user.email) {
      // Build the best available CTA URL
      const taskUrl    = payload.taskId    ? `${APP_URL}/tasks/${payload.taskId}`    : undefined
      const projectUrl = payload.projectId ? `${APP_URL}/my-projects`                : undefined
      const ctaUrl     =
        payload.emailExtras?.subtaskUrl ||
        payload.emailExtras?.taskUrl    ||
        taskUrl                         ||
        payload.emailExtras?.projectUrl ||
        projectUrl                      ||
        APP_URL

      // Fire-and-forget — email failure must never break the app
      fetch(`/api/email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:            user.email,
          recipientName: user.full_name || '',
          subject:       payload.emailSubject || defaultSubject(payload.eventKey, payload.entityName),
          message:       payload.message,
          ctaUrl,
          ctaLabel:      defaultCtaLabel(payload.eventKey),
          extras: {
            taskUrl,
            projectUrl,
            ...payload.emailExtras,
          },
        }),
      }).catch(err => console.error('[sendNotification] email failed:', err))
    }
  }
}

// ── Helper: default email subject lines ───────────────────────────────────────

function defaultSubject(eventKey: EventKey, entityName?: string): string {
  const name = entityName ? `"${entityName}"` : 'an item'
  const map: Record<EventKey, string> = {
    task_assigned:      `You've been assigned to ${name}`,
    subtask_assigned:   `You've been assigned to a subtask in ${name}`,
    task_unassigned:    `You were removed from ${name}`,
    task_status_changed:`Status update on ${name}`,
    task_completed:     `Task completed: ${name}`,
    task_due_soon:      `⏰ Reminder: ${name} is due soon`,
    task_overdue:       `⚠️ Overdue: ${name}`,
    task_created:       `New task created: ${name}`,
    project_milestone:  `🚀 Project milestone reached: ${name}`,
    project_assigned:   `You've been added to ${name}`,
    user_joined:        'New user joined ConOps Tasker',
    password_reset_sent:'Your password reset link',
  }
  return map[eventKey] || 'ConOps Tasker Notification'
}

function defaultCtaLabel(eventKey: EventKey): string {
  const map: Partial<Record<EventKey, string>> = {
    task_assigned:      'View Task',
    subtask_assigned:   'View Task',
    task_unassigned:    'My Tasks',
    task_status_changed:'View Task',
    task_completed:     'View Task',
    task_due_soon:      'View Task',
    task_overdue:       'View Overdue Task',
    task_created:       'View Task',
    project_milestone:  'View Project',
    project_assigned:   'View Project',
    user_joined:        'Open ConOps Tasker',
    password_reset_sent:'Reset Password',
  }
  return map[eventKey] || 'Open ConOps Tasker'
}

// ── Helper: get deadline_days config ──────────────────────────────────────────

export async function getDeadlineDays(): Promise<number> {
  const { data } = await supabase
    .from('NotificationConfig')
    .select('deadline_days')
    .eq('event_key', 'task_due_soon')
    .single()
  return data?.deadline_days ?? 2
}

// ── Convenience functions ──────────────────────────────────────────────────────
// All signatures are backward-compatible with your existing callers.
// New optional params (taskId, subtaskId, projectId) default to null.

export async function notifyTaskAssigned(
  taskId: string,
  taskName: string,
  projectName: string,
  assigneeIds: string[],
  triggeredBy?: string,
  projectId?: string | null,
) {
  if (!assigneeIds.length) return
  await sendNotification({
    eventKey:     'task_assigned',
    triggeredBy,
    targetUserIds: assigneeIds,
    taskId:       Number(taskId) || null,
    projectId:    projectId ?? null,
    entityType:   'task',
    entityId:     taskId,
    entityName:   taskName,
    message:      `You were assigned to task "${taskName}"${projectName ? ` in ${projectName}` : ''}.`,
    emailSubject: `You've been assigned to "${taskName}"`,
    emailExtras:  { taskName, projectName, taskUrl: `${APP_URL}/tasks/${taskId}` },
  })
}

export async function notifySubtaskAssigned(
  taskId: string,
  subtaskId: string,
  subtaskName: string,
  taskName: string,
  assigneeIds: string[],
  triggeredBy?: string,
  projectId?: string | null,
) {
  if (!assigneeIds.length) return
  await sendNotification({
    eventKey:     'subtask_assigned',
    triggeredBy,
    targetUserIds: assigneeIds,
    taskId:       Number(taskId)    || null,
    subtaskId:    Number(subtaskId) || null,
    projectId:    projectId ?? null,
    entityType:   'subtask',
    entityId:     subtaskId,
    entityName:   subtaskName,
    message:      `You were assigned to subtask "${subtaskName}" under "${taskName}".`,
    emailSubject: `You've been assigned to a subtask in "${taskName}"`,
    emailExtras:  {
      taskName,
      subtaskUrl: `${APP_URL}/tasks/${taskId}`,   // subtasks are shown on the task page
      taskUrl:    `${APP_URL}/tasks/${taskId}`,
    },
  })
}

export async function notifyTaskUnassigned(
  taskId: string,
  taskName: string,
  removedUserIds: string[],
  triggeredBy?: string,
) {
  if (!removedUserIds.length) return
  await sendNotification({
    eventKey:     'task_unassigned',
    triggeredBy,
    targetUserIds: removedUserIds,
    taskId:       Number(taskId) || null,
    entityType:   'task',
    entityId:     taskId,
    entityName:   taskName,
    message:      `You were removed from task "${taskName}".`,
    emailExtras:  { taskName },
  })
}

export async function notifyTaskStatusChanged(
  taskId: string,
  taskName: string,
  newStatus: string,
  assigneeIds: string[],
  projectName: string,
  triggeredBy?: string,
  projectId?: string | null,
) {
  if (!assigneeIds.length) return

  // Also notify managers (same as before)
  const { data: managers } = await supabase
    .from('Users').select('id').eq('role', 'Manager')
  const managerIds = (managers || []).map((u: any) => u.id)
  const allIds = [...new Set([...assigneeIds, ...managerIds])]

  await sendNotification({
    eventKey:     'task_status_changed',
    triggeredBy,
    targetUserIds: allIds,
    taskId:       Number(taskId) || null,
    projectId:    projectId ?? null,
    entityType:   'task',
    entityId:     taskId,
    entityName:   taskName,
    message:      `Task "${taskName}" status changed to "${newStatus}"${projectName ? ` in ${projectName}` : ''}.`,
    emailExtras:  { taskName, projectName, taskUrl: `${APP_URL}/tasks/${taskId}` },
  })
}

export async function notifyTaskCompleted(
  taskId: string,
  taskName: string,
  projectName: string,
  triggeredBy?: string,
  projectId?: string | null,
) {
  const { data: managers } = await supabase
    .from('Users').select('id').in('role', ['Manager', 'Admin'])
  const ids = (managers || []).map((u: any) => u.id)
  if (!ids.length) return

  await sendNotification({
    eventKey:     'task_completed',
    triggeredBy,
    targetUserIds: ids,
    taskId:       Number(taskId) || null,
    projectId:    projectId ?? null,
    entityType:   'task',
    entityId:     taskId,
    entityName:   taskName,
    message:      `Task "${taskName}" was marked Completed${projectName ? ` in ${projectName}` : ''}.`,
    emailExtras:  { taskName, projectName, taskUrl: `${APP_URL}/tasks/${taskId}` },
  })
}

export async function notifyTaskCreated(
  taskId: string,
  taskName: string,
  projectName: string,
  triggeredBy?: string,
  projectId?: string | null,
) {
  const { data: managers } = await supabase
    .from('Users').select('id').in('role', ['Manager', 'Admin'])
  const ids = (managers || []).map((u: any) => u.id)
  if (!ids.length) return

  await sendNotification({
    eventKey:     'task_created',
    triggeredBy,
    targetUserIds: ids,
    taskId:       Number(taskId) || null,
    projectId:    projectId ?? null,
    entityType:   'task',
    entityId:     taskId,
    entityName:   taskName,
    message:      `New task "${taskName}" was created${projectName ? ` in ${projectName}` : ''}.`,
    emailExtras:  { taskName, projectName, taskUrl: `${APP_URL}/tasks/${taskId}` },
  })
}

// ── NEW: Project assigned ─────────────────────────────────────────────────────

export async function notifyProjectAssigned(
  projectId: string,
  projectName: string,
  memberIds: string[],
  triggeredBy?: string,
) {
  if (!memberIds.length) return
  await sendNotification({
    eventKey:     'project_assigned',
    triggeredBy,
    targetUserIds: memberIds,
    projectId,
    entityType:   'project',
    entityId:     projectId,
    entityName:   projectName,
    message:      `You've been added to the project "${projectName}".`,
    emailSubject: `You've been added to "${projectName}"`,
    emailExtras:  { projectName, projectUrl: `${APP_URL}/my-projects` },
  })
}

export async function notifyUserJoined(
  newUserName: string,
  newUserEmail: string,
) {
  const { data: managers } = await supabase
    .from('Users').select('id').in('role', ['Manager', 'Admin'])
  const ids = (managers || []).map((u: any) => u.id)
  if (!ids.length) return
  await sendNotification({
    eventKey:     'user_joined',
    targetUserIds: ids,
    entityType:   'user',
    entityName:   newUserName,
    message:      `New user "${newUserName}" (${newUserEmail}) joined the system.`,
  })
}

export async function notifyPasswordResetSent(
  targetUserId: string,
  targetUserName: string,
) {
  await sendNotification({
    eventKey:     'password_reset_sent',
    targetUserIds: [targetUserId],
    entityType:   'user',
    entityName:   targetUserName,
    message:      'A password reset link has been sent to your email.',
  })
}

export async function notifyProjectMilestone(
  projectName: string,
  milestone: number,
  projectId?: string | null,
) {
  const { data: managers } = await supabase
    .from('Users').select('id').in('role', ['Manager', 'Admin'])
  const ids = (managers || []).map((u: any) => u.id)
  if (!ids.length) return
  await sendNotification({
    eventKey:     'project_milestone',
    targetUserIds: ids,
    projectId:    projectId ?? null,
    entityType:   'project',
    entityName:   projectName,
    message:      `Project "${projectName}" has reached ${milestone}% completion! 🎉`,
    emailExtras:  { projectName, projectUrl: `${APP_URL}/my-projects` },
  })
}

// ── Due soon / overdue checker ────────────────────────────────────────────────
// Call this from a cron route (e.g. /api/cron/check-tasks)

export async function checkDueSoonTasks() {
  const deadlineDays = await getDeadlineDays()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const cutoff = new Date(today.getTime() + deadlineDays * 864e5)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const todayStr  = today.toISOString().split('T')[0]

  const { data: tasks } = await supabase
    .from('Tasks')
    .select('*')
    .neq('status', 'Completed')
    .gte('end_date', todayStr)
    .lte('end_date', cutoffStr)

  for (const task of tasks || []) {
    const ownerNames: string[] = task.owner
      ? task.owner.split(',').map((o: string) => o.trim()).filter(Boolean)
      : []
    if (!ownerNames.length) continue

    const { data: users } = await supabase
      .from('Users').select('id, full_name').in('full_name', ownerNames)
    const ids = (users || []).map((u: any) => u.id)
    if (!ids.length) continue

    await sendNotification({
      eventKey:     'task_due_soon',
      targetUserIds: ids,
      taskId:       Number(task.id) || null,
      entityType:   'task',
      entityId:     task.id,
      entityName:   task.topic,
      message:      `Task "${task.topic}" is due on ${task.end_date} (in ${deadlineDays} day${deadlineDays !== 1 ? 's' : ''}).`,
      emailSubject: `⏰ Reminder: "${task.topic}" is due soon`,
      emailExtras:  {
        taskName: task.topic,
        dueDate:  task.end_date,
        taskUrl:  `${APP_URL}/tasks/${task.id}`,
      },
    })
  }
}

export async function checkOverdueTasks() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const { data: tasks } = await supabase
    .from('Tasks')
    .select('*')
    .neq('status', 'Completed')
    .lt('end_date', todayStr)

  for (const task of tasks || []) {
    const ownerNames: string[] = task.owner
      ? task.owner.split(',').map((o: string) => o.trim()).filter(Boolean)
      : []
    if (!ownerNames.length) continue

    const { data: users } = await supabase
      .from('Users').select('id, full_name').in('full_name', ownerNames)
    const ids = (users || []).map((u: any) => u.id)
    if (!ids.length) continue

    await sendNotification({
      eventKey:     'task_overdue',
      targetUserIds: ids,
      taskId:       Number(task.id) || null,
      entityType:   'task',
      entityId:     task.id,
      entityName:   task.topic,
      message:      `Task "${task.topic}" is overdue (was due ${task.end_date}).`,
      emailSubject: `⚠️ Overdue: "${task.topic}"`,
      emailExtras:  {
        taskName: task.topic,
        dueDate:  task.end_date,
        taskUrl:  `${APP_URL}/tasks/${task.id}`,
      },
    })
  }
}