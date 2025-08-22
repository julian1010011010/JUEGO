import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  // ...existing code...
  plugins: [
    // ...otros plugins...
    viteStaticCopy({
      targets: [
        {
          src: 'assets',
          dest: ''
        }
      ]
    })
  ]
  // ...existing code...
})