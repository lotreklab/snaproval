import { createRouter, createWebHistory } from 'vue-router'
import WebsiteExporter from '../components/WebsiteExporter.vue'
import ResultsPage from '../components/ResultsPage.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: WebsiteExporter
  },
  {
    path: '/results',
    name: 'Results',
    component: ResultsPage
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router