import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    server: {
        proxy: {
            '/api/': {
                target: 'http://localhost:5823/', // 确认这里是你 Koa 后端的实际端口
                changeOrigin: true,
            },
            '/static/': {
                target: 'http://localhost:5823/', // 确认这里是你 Koa 后端的实际端口
                changeOrigin: true,
            }
        }
    }
})
