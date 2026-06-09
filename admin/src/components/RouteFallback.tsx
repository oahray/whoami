import LoadingState from './LoadingState'

/** Shown while a lazy-loaded route chunk is downloading. */
export default function RouteFallback() {
  return <LoadingState label="Loading" layout="page" />
}
