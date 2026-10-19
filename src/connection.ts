/** Re-evaluate the native entry through Cordis without editing or persisting
 * its policy. A remount also refreshes the cached remote-access flag. */
export function refreshNativeConnection(loader: unknown): void {
  const tree = loader as { entries?: () => Iterable<{
    options: { id: string; name: string; config?: unknown }
    fiber?: { update(config: unknown, force?: boolean): void }
  }> } | undefined
  for (const entry of tree?.entries?.() ?? []) {
    if (entry.options.id !== 'connection' || entry.options.name !== '@deepseek-ai/dsh-client-connection') continue
    entry.fiber?.update(entry.options.config, true)
  }
}
