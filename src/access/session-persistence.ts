import { credentialKey, type CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { tokenDigest } from './password.js'
import type { SessionRecord } from './sessions.js'

const KEY = credentialKey('dsh-access-gate', 'sessions')
const PASSWORD_KEY = credentialKey('dsh-access-gate', 'password')

/** Persist only token digests, bound to the password generation that issued them. */
export function credentialSessionPersistence(credentials: CredentialProvider) {
  let generation: string | undefined
  const currentGeneration = async (): Promise<string | undefined> => {
    const password = await credentials.readRecord(PASSWORD_KEY)
    return password === undefined ? undefined : tokenDigest(JSON.stringify(password))
  }
  return {
    async load(): Promise<unknown> {
      generation = await currentGeneration()
      const record = await credentials.readRecord(KEY)
      if (record?.kind !== 'grant' || !generation) return []
      const payload = record.payload as { version?: unknown; generation?: unknown; sessions?: unknown } | null
      return payload?.version === 1 && payload.generation === generation ? payload.sessions : []
    },
    async save(sessions: SessionRecord[]): Promise<void> {
      const current = await currentGeneration()
      // A password change cannot accidentally rebind old sessions to the new password.
      if (current !== generation && sessions.length !== 0) throw new Error('session password generation changed')
      await credentials.modifyRecord(KEY, async () => ({
        kind: 'grant', payload: { version: 1, generation: current ?? '', sessions },
      }))
      generation = current
    },
  }
}
