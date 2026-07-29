/** PostgREST/Supabase default max rows per response. */
export const SUPABASE_PAGE_SIZE = 1000

type PageResult<T> = {
  data: T[] | null
  error: { message: string } | null
}

/**
 * Walk `.range()` pages until a short page is returned so callers are not
 * silently truncated at Supabase's default 1000-row limit.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await fetchPage(from, from + SUPABASE_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    all.push(...page)
    if (page.length < SUPABASE_PAGE_SIZE) break
    from += SUPABASE_PAGE_SIZE
  }
  return all
}
