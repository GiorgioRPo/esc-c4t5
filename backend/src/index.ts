import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import bookings from './models/booking.js'
import hotels from './models/hotels.js'
import prices from './models/prices.js'

const app = new Hono()
app.use('/api/*', cors({origin:'http://localhost:3001'}))
app.get('/', (c) => {
  return c.text('Hello Hono!')
})
app.route('/api/bookings', bookings)

app.route('/api/hotels', hotels)
app.route('/api/hotels/prices', prices)
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})



