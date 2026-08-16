import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers
} from 'obscenity'

/** Extra allowlist terms. Keep empty unless a real nickname false-positive appears. */
const CUSTOM_WHITELIST: readonly string[] = []

const built = englishDataset.build()

const matcher = new RegExpMatcher({
  ...built,
  ...englishRecommendedTransformers,
  whitelistedTerms: [...(built.whitelistedTerms ?? []), ...CUSTOM_WHITELIST]
})

/** True when the nickname should be rejected for language. */
export function nicknameIsBlocked(nickname: string): boolean {
  return matcher.hasMatch(nickname)
}
