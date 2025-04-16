import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createExpressApp } from './server/middleware.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'configure-express-server',
      configureServer(server) {
        // Create and use Express app as middleware
        const app = createExpressApp();
        server.middlewares.use(app);
      }
    }
  ]
})
