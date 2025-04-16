import { createExpressApp } from './app.js'

const PORT = process.env.PORT || 3000

const app = createExpressApp()
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })
