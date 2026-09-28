import type { Volatile } from '@deepseek-ai/cordis'
import { resolveConfig, type Config } from './config.js'

/** Socket/session settings stay fixed until restart; the share gate reads live. */
export function accessRuntimeConfig(source: Volatile<Config>): Config {
  const initial = resolveConfig(structuredClone(source.get()) as Config)
  return {
    ...initial,
    get allowAnonymousKnowledgeShares() { return source.get().allowAnonymousKnowledgeShares === true },
  }
}
