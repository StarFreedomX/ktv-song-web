// frontend/src/vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [vue()],
        server: {
            proxy: {
                '/api/': {
                    target: env.VITE_BACKEND_URL || 'http://localhost:5823/',
                    changeOrigin: true
                }
            }
        }
    }
})
