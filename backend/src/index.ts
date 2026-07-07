import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import bookings from './models/booking.js'
import 'dotenv/config'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})
app.route('/api/bookings', bookings)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
