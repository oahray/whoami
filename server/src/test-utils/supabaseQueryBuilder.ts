/**
 * Shared mock for the supabase-js fluent query builder used in admin route tests.
 *
 * The real builder accepts long chains like:
 *   supabase.from('clues').select('*', { count: 'exact', head: true }).eq(...).is(...)
 *
 * Tests don't need to model network behaviour — they just need to:
 *   1. Record which methods were called with which args (so the resolver can
 *      branch on the shape of the query), and
 *   2. Resolve to a `{ data, error }` (or `{ count, error }`) shape exactly the
 *      way the production code awaits.
 *
 * Each chained method returns the same builder; awaiting it (via the `then`
 * trap) calls the supplied `resolver(state)` and resolves with whatever that
 * function returns. That makes the mock compositional: a test mocks
 * `supabase.from` once, returns this builder, and the resolver inspects
 * `state.table` + `state.operations` to decide what to give back.
 */

export type QueryState = {
  table: string
  operations: Array<{ method: string; args: unknown[] }>
}

export type QueryResolver = (state: QueryState) => unknown

export function createQueryBuilder(table: string, resolver: QueryResolver) {
  const state: QueryState = { table, operations: [] }

  const builder: any = {}
  const chained = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'in',
    'is',
    'ilike',
    'like',
    'order',
    'limit',
    'single',
    'maybeSingle'
  ] as const

  for (const method of chained) {
    builder[method] = (...args: unknown[]) => {
      state.operations.push({ method, args })
      return builder
    }
  }

  builder.then = (resolve: any, reject: any) =>
    Promise.resolve(resolver(state)).then(resolve, reject)

  return builder
}

export function hasOp(state: QueryState, method: string, predicate?: (args: unknown[]) => boolean) {
  return state.operations.some(op => op.method === method && (!predicate || predicate(op.args)))
}

export function hasEq(state: QueryState, column: string, value: unknown) {
  return hasOp(state, 'eq', args => args[0] === column && args[1] === value)
}

export function hasIs(state: QueryState, column: string, value: unknown) {
  return hasOp(state, 'is', args => args[0] === column && args[1] === value)
}

export function findOp(state: QueryState, method: string) {
  return state.operations.find(op => op.method === method)
}
