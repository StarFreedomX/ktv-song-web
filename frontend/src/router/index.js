// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import Home from '../Home.vue' // 确保你的 Home.vue 放在 src/views 下
import AppMain from '../App.vue'     // 你原本的点歌主页面

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home
    },
    {
        path: '/:roomId',
        name: 'Room',
        component: AppMain // 让原本的 App.vue 承担房间页面的角色
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
