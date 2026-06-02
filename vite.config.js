import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { networkInterfaces } from 'os'

function getLocalIP() {
  for (const nets of Object.values(networkInterfaces())) {
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}

function showMobileUrl({ secure = false } = {}) {
  return {
    name: 'show-mobile-url',
    configureServer(server) {
      const orig = server.printUrls.bind(server)
      server.printUrls = () => {
        orig()
        const ip = getLocalIP()
        const address = server.httpServer?.address()
        const port = typeof address === 'object' && address ? address.port : server.config.server.port
        const protocol = secure ? 'https' : 'http'
        console.log(`\n  📱 \x1b[1m\x1b[36mĐiện thoại cùng WiFi:\x1b[0m`)
        console.log(`     \x1b[4m\x1b[33m${protocol}://${ip}:${port}/learnPronunciation/\x1b[0m\n`)
      }
    },
  }
}

export default defineConfig({
  base: process.env.VERCEL ? '/' : '/learnPronunciation/',
  plugins: [
    react(),
    ...(process.env.npm_lifecycle_event === 'dev:mobile' ? [basicSsl(), showMobileUrl({ secure: true })] : [showMobileUrl()]),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
})
