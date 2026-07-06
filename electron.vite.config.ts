/**
 * electron-vite build configuration.
 *
 * - main/preload: Node targets with dependencies externalized (not bundled)
 * - preload outputs CJS (`index.cjs`) because Electron preload cannot use ESM
 * - renderer: React app with `@renderer` path alias
 */
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs' 
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
  }
})