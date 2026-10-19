import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://giiang3.github.io/forms/
export default defineConfig({
  base: '/forms/',
  plugins: [react()],
})
