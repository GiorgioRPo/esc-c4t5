// authors.ts
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.json(`lu cakap bangat`)
})
app.post('/', (c) => c.json('create an author', 201))
app.get('/:id', (c) => c.json(`Show author number ${c.req.param('id')}`))

export default app
