/**
 * Public Google Form URL for anonymous feedback / problem reports.
 * Set `VITE_FEEDBACK_FORM_URL` in client env (production + local as needed).
 * Leave unset to hide feedback links in the UI.
 */
export function getFeedbackFormUrl(): string | null {
  const raw = import.meta.env.VITE_FEEDBACK_FORM_URL
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function isFeedbackConfigured(): boolean {
  return getFeedbackFormUrl() !== null
}
