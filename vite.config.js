import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    obfuscatorPlugin({
      include: ['src/renderer/**/*.js', 'src/lib/ffmpeg.js', 'src/tools/**/*.jsx'],
      exclude: [/node_modules/],
      apply: 'build',
      debugger: true,
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 1,
        numbersToExpressions: true,
        simplify: true,
        stringArrayShuffle: true,
        splitStrings: true,
        stringArrayThreshold: 1
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@ffmpeg')) {
            return 'ffmpeg-vendor';
          }
          if (id.includes('node_modules/firebase')) {
            return 'firebase-vendor';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'framer-motion-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide-vendor';
          }
        }
      }
    }
  },
  server: {
    proxy: {
      '/__/auth': {
        target: 'https://animation-maker-9e47a.firebaseapp.com',
        changeOrigin: true,
      }
    }
  }
})