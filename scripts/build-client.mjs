import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const pluginId = '@lemoncat7/dsh-remote-settings-compat'
const require = createRequire(import.meta.url)
const officialConnectionPath = require.resolve('@deepseek-ai/dsh-client-connection/client')
const officialConnectionFactory = (await readFile(officialConnectionPath, 'utf8'))
  .replace(/\n\/\/# sourceMappingURL=client\.js\.map\s*$/u, '')

await build({
  entryPoints: ['src/client.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: true,
  external: [
    '@deepseek-ai/dsh-client-connection',
    'react',
    'react/jsx-runtime',
  ],
  loader: { '.css': 'text' },
  banner: {
    js: `${officialConnectionFactory}\nwindow.__ModuleLoader__.load({ id: ${JSON.stringify(pluginId)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: 'return module.exports; } });',
  },
})
