import { createInterface } from 'node:readline'

/** Waarde van een `--naam waarde`-argument. */
export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/** Vraagt invoer zonder die op het scherm te tonen (voor wachtwoorden). */
export async function askHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream }
  let muted = false
  out._writeToOutput = (s: string) => {
    if (!muted || s.includes('\n')) out.output.write(muted ? '\n' : s)
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
    muted = true
  })
}

/**
 * Wachtwoord uit NEW_USER_PASSWORD of interactief; zonder terminal een
 * tijdelijk wachtwoord dat bij de eerste login gewijzigd moet worden.
 */
export async function readPassword(generate: () => string): Promise<{ password: string; temporary: boolean }> {
  let password = process.env.NEW_USER_PASSWORD ?? ''
  if (!password && process.stdin.isTTY) {
    password = await askHidden('Wachtwoord (min. 12 tekens): ')
    const repeat = await askHidden('Herhaal wachtwoord: ')
    if (password !== repeat) throw new Error('De wachtwoorden komen niet overeen.')
  }
  if (password) return { password, temporary: false }
  return { password: generate(), temporary: true }
}
