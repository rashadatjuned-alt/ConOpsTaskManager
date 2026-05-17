/**
 * app/api/email/route.ts
 *
 * Sends transactional + broadcast emails via Brevo (formerly Sendinblue).
 *
 * Required env vars:
 *   BREVO_API_KEY         — from brevo.com → SMTP & API → API Keys
 *   EMAIL_FROM            — your Gmail or any email e.g. yourname@gmail.com
 *   EMAIL_FROM_NAME       — display name e.g. "ConOps Tasker" (optional)
 *   NEXT_PUBLIC_APP_URL   — e.g. https://your-app.vercel.app
 *
 * Body (JSON):
 *   to            string    — single recipient email
 *   emails        string[]  — multiple recipients (broadcast)
 *   subject       string
 *   message       string
 *   recipientName string    — optional greeting name
 *   ctaUrl        string    — button link
 *   ctaLabel      string    — button text
 *   extras        object    — taskName, projectName, dueDate, taskUrl, etc.
 */

import { NextRequest, NextResponse } from 'next/server'

const BREVO_API_KEY = process.env.BREVO_API_KEY!
const FROM_EMAIL    = process.env.EMAIL_FROM || 'noreply@example.com'
const FROM_NAME     = process.env.EMAIL_FROM_NAME || 'ConOps Tasker'
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      to,
      emails,
      subject,
      message,
      recipientName,
      ctaUrl,
      ctaLabel,
      extras = {},
    } = body

    const recipients: string[] = emails ?? (to ? [to] : [])
    if (!recipients.length) {
      return NextResponse.json({ error: 'No recipients provided' }, { status: 400 })
    }
    if (!subject || !message) {
      return NextResponse.json({ error: 'subject and message are required' }, { status: 400 })
    }

    const html = buildHtml({
      recipientName,
      message,
      ctaUrl:   ctaUrl   || APP_URL,
      ctaLabel: ctaLabel || 'Open ConOps Tasker',
      extras,
    })

    // Send individually so each person gets a personalised email
    const results = await Promise.allSettled(
      recipients.map(email =>
        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept':       'application/json',
            'api-key':      BREVO_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name:  FROM_NAME,
              email: FROM_EMAIL,
            },
            to: [{ email }],
            subject,
            htmlContent: html,
          }),
        })
      )
    )

    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length > 0) {
      console.error('[/api/email] Some emails failed:', failed)
    }

    return NextResponse.json({
      ok:     true,
      sent:   recipients.length - failed.length,
      failed: failed.length,
    })
  } catch (err: any) {
    console.error('[/api/email]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── HTML builder ──────────────────────────────────────────────────────────────

interface BuildOpts {
  recipientName?: string
  message: string
  ctaUrl: string
  ctaLabel: string
  extras: {
    taskName?:    string
    projectName?: string
    dueDate?:     string
    taskUrl?:     string
    subtaskUrl?:  string
    projectUrl?:  string
    commentUrl?:  string
  }
}

function buildHtml(opts: BuildOpts): string {
  const { recipientName, message, ctaUrl, ctaLabel, extras } = opts
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,'

  const rows: string[] = []
  if (extras.taskName)    rows.push(row('Task',       extras.taskName,    extras.taskUrl))
  if (extras.projectName) rows.push(row('Project',    extras.projectName, extras.projectUrl))
  if (extras.dueDate)     rows.push(row('Due Date',   extras.dueDate))
  if (extras.subtaskUrl)  rows.push(row('Subtask',    'View subtask',     extras.subtaskUrl))
  if (extras.commentUrl)  rows.push(row('Discussion', 'Open thread',      extras.commentUrl))

  const detailsTable = rows.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse;">${rows.join('')}</table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;color:#111;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;border:1px solid #e0e0e0;overflow:hidden;">

      <!-- Header -->
      <tr><td style="background:#3B6D11;padding:18px 32px;">
        <span style="font-size:17px;font-weight:700;color:#EAF3DE;letter-spacing:-0.02em;">⬛ ConOps Tasker</span>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px;">
        <p style="margin:0 0 14px;font-size:15px;color:#555;">${esc(greeting)}</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#111;">${esc(message)}</p>

        ${detailsTable}

        <!-- CTA button -->
        <table cellpadding="0" cellspacing="0" style="margin:4px 0 28px;">
          <tr><td style="background:#3B6D11;border-radius:8px;">
            <a href="${ctaUrl}"
               style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#EAF3DE;text-decoration:none;">
              ${esc(ctaLabel)} →
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font-size:11px;color:#aaa;line-height:1.6;">
          Or copy this link:<br/>
          <a href="${ctaUrl}" style="color:#3B6D11;word-break:break-all;">${ctaUrl}</a>
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f9f9f9;padding:14px 32px;border-top:1px solid #eee;">
        <p style="margin:0;font-size:11px;color:#aaa;">
          You're receiving this as a member of ConOps Tasker.
          Manage notification preferences in Admin → Notifications.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

function row(label: string, value: string, href?: string): string {
  const content = href
    ? `<a href="${href}" style="color:#3B6D11;font-weight:500;text-decoration:none;">${esc(value)}</a>`
    : `<span style="color:#111;">${esc(value)}</span>`
  return `<tr>
    <td style="padding:7px 0;border-bottom:1px solid #f0f0f0;width:110px;font-size:11px;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.04em;vertical-align:top;">${esc(label)}</td>
    <td style="padding:7px 0 7px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;vertical-align:top;">${content}</td>
  </tr>`
}

function esc(s: string = ''): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}