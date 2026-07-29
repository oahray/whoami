import type { ReactNode } from 'react'
import { getFeedbackFormUrl } from '../lib/feedback'

type FeedbackLinkProps = {
  className?: string
  children?: ReactNode
}

/** Opens the configured Google Form in a new tab. Renders nothing if unset. */
export default function FeedbackLink({
  className = '',
  children = 'Send feedback'
}: FeedbackLinkProps) {
  const href = getFeedbackFormUrl()
  if (!href) return null

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}
