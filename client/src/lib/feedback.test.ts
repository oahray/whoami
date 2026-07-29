import { describe, expect, it, vi, afterEach } from 'vitest'
import { getFeedbackFormUrl, isFeedbackConfigured } from './feedback'

describe('feedback', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null when the form URL is unset', () => {
    vi.stubEnv('VITE_FEEDBACK_FORM_URL', '')
    expect(getFeedbackFormUrl()).toBeNull()
    expect(isFeedbackConfigured()).toBe(false)
  })

  it('returns a normalized https form URL', () => {
    vi.stubEnv('VITE_FEEDBACK_FORM_URL', ' https://docs.google.com/forms/d/e/abc/viewform ')
    expect(getFeedbackFormUrl()).toBe('https://docs.google.com/forms/d/e/abc/viewform')
    expect(isFeedbackConfigured()).toBe(true)
  })

  it('rejects invalid URLs', () => {
    vi.stubEnv('VITE_FEEDBACK_FORM_URL', 'not-a-url')
    expect(getFeedbackFormUrl()).toBeNull()
  })
})
