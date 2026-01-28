// frontend/src/vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const backendUrl = env.BACKEND_URL || 'http://localhost:5823';
    if (command === 'serve') console.log('env backend url:', backendUrl)
    return {
        plugins: [vue()],
        server: {
            proxy: {
                '/api/': {
                    target: backendUrl,
                    changeOrigin: true,
                    ws: true,
                }
            }
        }
    }
})
