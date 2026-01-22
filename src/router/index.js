import { createRouter, createWebHistory } from 'vue-router'
import Map from '@/components/map.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {path:'/',component:Map}
  ],
})

export default router
