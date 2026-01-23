import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    server: {
        // 这一段是为了让你的前端能访问到 Koa 后端
        proxy: {
            '/api': {
                target: 'http://localhost:5823', // 确认这里是你 Koa 后端的实际端口
                changeOrigin: true,
            }
        }
    }
})
