const TEST_MODE = import.meta.env.MODE === 'test'

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function backoffMs(attempt: number): number {
  return TEST_MODE ? 0 : 250 * 2 ** attempt
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429
}

/**
 * GET JSON with retries on 5xx, 429, and network failures.
 * Other 4xx responses fail on the first response.
 */
export async function fetchOkJson<T>(
  url: string,
  errorMessage: (status: number) => string,
  options?: { retries?: number }
): Promise<T> {
  const retries = options?.retries ?? 2
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response: Response
    try {
      response = await fetch(url)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(errorMessage(0))
      if (attempt === retries) throw lastError
      await delay(backoffMs(attempt))
      continue
    }

    if (response.ok) {
      return (await response.json()) as T
    }

    lastError = new Error(errorMessage(response.status))
    if (!isRetryableStatus(response.status) || attempt === retries) {
      throw lastError
    }
    await delay(backoffMs(attempt))
  }

  throw lastError ?? new Error(errorMessage(0))
}
