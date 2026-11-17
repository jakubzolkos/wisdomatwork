/**
 * Tiny HTML escape for interpolating untrusted strings (titles, names,
 * bodies) into email templates. Keep this aligned with the safe set
 * the email-rendering ecosystem expects: &, <, >, ", '.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const NAME_TITLES = new Set(['dr', 'mr', 'mrs', 'ms', 'mx', 'prof', 'rev', 'fr', 'sr', 'br'])

/**
 * First name for a greeting: "Jane Doe" -> "Jane", "Dr. Jane Doe" -> "Jane".
 * Falls back to the whole name if nothing else is usable, and to null when
 * empty.
 */
export function firstNameOf(fullName: string | null | undefined): string | null {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const rest = parts.filter((p, i) => !(i === 0 && NAME_TITLES.has(p.replace(/\.$/, '').toLowerCase())))
  return (rest[0] ?? parts[0]) || null
}

/**
 * Converts a plain-text body (paragraphs separated by blank lines) into
 * safe HTML <p> blocks with <br> for single line breaks.
 */
export function bodyToHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937;">${escapeHtml(
          p,
        ).replace(/\n/g, '<br />')}</p>`,
    )
    .join('')
}

export type BaseLayoutOptions = {
  /**
   * Short text shown in the inbox preview pane (Gmail / Outlook). Pull
   * from the body if not provided.
   */
  previewText?: string
  /**
   * Heading text shown in the email card. Defaults to the brand name.
   */
  heading?: string
  /**
   * Optional footer note (e.g. "You are receiving this email because
   * you are a member of the 2025 cohort.").
   */
  footerNote?: string
}

const BRAND_NAME = 'WaW Fellows Portal'

/**
 * Renders a complete, email-client-friendly HTML document around the
 * given inner content. Uses inline styles only and a 600px centered
 * card layout that degrades gracefully in plain text clients.
 */
export function renderBaseLayout(
  innerHtml: string,
  options: BaseLayoutOptions = {},
): string {
  const preview = options.previewText ?? ''
  const heading = options.heading ?? BRAND_NAME
  const footerNote = options.footerNote ?? ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(
      preview,
    )}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;background-color:#0f172a;">
                <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#cbd5e1;">${escapeHtml(
                  BRAND_NAME,
                )}</p>
                <h1 style="margin:6px 0 0;font-size:20px;line-height:1.3;color:#ffffff;font-weight:600;">${escapeHtml(
                  heading,
                )}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e5e7eb;background-color:#f9fafb;">
                <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#6b7280;">${escapeHtml(
                  BRAND_NAME,
                )}</p>
                ${
                  footerNote
                    ? `<p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${escapeHtml(
                        footerNote,
                      )}</p>`
                    : ''
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/**
 * Renders a primary call-to-action button. Uses VML for Outlook and a
 * fallback table-based button for everyone else.
 */
export function renderCtaButton(label: string, url: string): string {
  const safeLabel = escapeHtml(label)
  const safeUrl = escapeHtml(url)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td align="center" bgcolor="#0f172a" style="border-radius:8px;">
        <a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${safeLabel}</a>
      </td>
    </tr>
  </table>`
}
