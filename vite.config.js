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

function showMobileUrl() {
  return {
    name: 'show-mobile-url',
    configureServer(server) {
      const orig = server.printUrls.bind(server)
      server.printUrls = () => {
        orig()
        const ip = getLocalIP()
        console.log(`\n  📱 \x1b[1m\x1b[36mĐiện thoại cùng WiFi:\x1b[0m`)
        console.log(`     \x1b[4m\x1b[33mhttps://${ip}:5173/EnglishPronunciation/\x1b[0m\n`)
      }
    },
  }
}

export default defineConfig({
  base: '/EnglishPronunciation/',
  plugins: [react(), basicSsl(), showMobileUrl()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
})
