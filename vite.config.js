import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // THE SHIELD: Tells Vite to stop compressing the C++ wrapper
  optimizeDeps: {
    exclude: ['@thatopen/components', 'web-ifc']
  },
  base: '/', // This is crucial for custom domains
})
