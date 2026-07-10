import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import bookings from './models/booking.js'
import hotels from './models/hotels.js'
import 'dotenv/config'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})
app.route('/api/bookings', bookings)

app.route('/api/hotels', hotels)
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})



