import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import bookings from './models/booking.js'
import hotels from './models/hotels.js'
import prices from './models/prices.js'
import hotelDetails from './models/hotelDetails.js'
import recommendations from './models/recommendations.js'
import stripeWebhook from "./webhooks.js";

const app = new Hono()
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',')
app.use('/api/*', cors({ origin: (origin) => ALLOWED_ORIGINS.includes(origin || '') ? origin : '', credentials: true }))
app.get('/', (c) => {
  return c.text('Hello Hono!')
})
app.route('/api/bookings', bookings)
app.route("/api/webhooks/stripe", stripeWebhook);
app.route('/api/hotels', hotels)
app.route('/api/hotels/prices', prices)
app.route('/api/hotels', hotelDetails)
app.route('/api/recommendations', recommendations)
serve({
  fetch: app.fetch,
  port: 3001
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})



