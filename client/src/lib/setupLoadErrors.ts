/** Player-facing copy for solo / pass-and-play setup load failures. */

export const SETUP_CONTENT_LOAD_ERROR =
  "Couldn't load game content. Check your connection and try again."

export const SETUP_ELIGIBILITY_LOAD_ERROR =
  "Couldn't check available difficulties. Try again in a moment."

export const SETUP_START_ERROR =
  "Couldn't start the game. Check your connection and try again."

export function logSetupLoadError(context: string, err: unknown): void {
  console.error(context, err)
}
