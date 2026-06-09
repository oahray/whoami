import { render, type RenderOptions } from '@testing-library/react'
import { type ReactElement } from 'react'
import { PreferencesProvider } from '../context/PreferencesContext'

export function renderWithPreferences(ui: ReactElement, options?: RenderOptions) {
  return render(<PreferencesProvider>{ui}</PreferencesProvider>, options)
}
