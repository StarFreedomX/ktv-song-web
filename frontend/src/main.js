// frontend/src/main.js
import { createApp } from 'vue'
import App from './AppEntry.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(router)
app.mount('#app')
