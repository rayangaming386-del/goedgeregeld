/** Resultaat van een beheeractie, voor useActionState. */
export type ActionState = {
  ok: boolean
  message?: string
  errors?: Record<string, string>
  /** Wijzigt na elke uitvoering, zodat dezelfde melding opnieuw kan verschijnen. */
  at?: number
  /** Eenmalig te tonen gegeven, zoals een tijdelijk wachtwoord. Wordt nergens bewaard. */
  secret?: { label: string; value: string }
}

export const INITIAL_STATE: ActionState = { ok: true }

export function fail(message: string, errors?: Record<string, string>): ActionState {
  return { ok: false, message, errors, at: Date.now() }
}

export function done(message: string, secret?: ActionState['secret']): ActionState {
  return { ok: true, message, at: Date.now(), secret }
}
