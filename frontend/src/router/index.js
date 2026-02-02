// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import Home from '../Home.vue'
import AppMain from '../App.vue'

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home
    },
    {
        path: '/room',
        name: 'Room',
        component: AppMain
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach((to, from, next) => {
    const path = to.path;
    // 如果路径不是根目录 '/' 且以 '/' 结尾
    if (path !== '/' && path.endsWith('/')) {
        const nextPath = path.slice(0, -1);
        next({
            path: nextPath,
            query: to.query,
            hash: to.hash,
            replace: true
        });
    } else {
        next();
    }
})

export default router
