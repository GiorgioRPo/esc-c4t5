import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import authors from './models/author.js'
import books from './models/book.js'
import { withSupabase } from '@supabase/server/adapters/hono'
import 'dotenv/config'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})
app.route('/authors', authors)
app.route('/books', books)
app.get('/todos', withSupabase({ auth: 'none' }), async (c) => {
  const { supabase } = c.var.supabaseContext
  const { data } = await supabase.from('todos').select('*')
  return c.json(data)
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
