/**
 * Generates an OpenAPI 3.1 document from the Zod schemas in schema.ts.
 * Run: npx tsx scripts/generate-openapi.mjs
 * Output: openapi.json (also written to disk for schemathesis)
 */
import { createDocument } from 'zod-openapi'
import { z } from 'zod'
import { bookingSchema, hotelsQuerySchema, searchQuerySchema } from '../schema.ts'

const doc = createDocument({
  openapi: '3.1.0',
  info: { title: 'Ascenda API', version: '1.0.0', description: 'Hotel search & booking backend' },
  servers: [{ url: 'http://localhost:3001', description: 'Local dev' }],
  paths: {

    '/api/bookings': {
      get: {
        summary: 'List current user bookings',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of bookings', content: { 'application/json': { schema: z.array(z.object({ id: z.string(), payment_id: z.string().nullable() })) } } },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        summary: 'Create a booking (initiates Stripe payment intent)',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: bookingSchema } } },
        responses: {
          '200': { description: 'Returns client_secret for Stripe confirmation' },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
        },
      },
    },

    '/api/hotels': {
      get: {
        summary: 'Search hotels by destination',
        tags: ['Hotels'],
        requestParams: { query: hotelsQuerySchema },
        responses: {
          '200': { description: 'Hotel listing' },
          '400': { description: 'Missing or invalid destination_id' },
          '502': { description: 'Upstream Ascenda API unavailable' },
        },
      },
    },

    '/api/hotels/prices': {
      get: {
        summary: 'Fetch priced hotel availability',
        tags: ['Hotels'],
        requestParams: { query: searchQuerySchema },
        responses: {
          '200': { description: 'Pricing data with completed flag' },
          '400': { description: 'Invalid parameters or dates' },
          '502': { description: 'Upstream Ascenda API unavailable' },
        },
      },
    },

    '/api/hotels/{id}/price': {
      get: {
        summary: 'Fetch price for a specific hotel',
        tags: ['Hotels'],
        requestParams: {
          path: z.object({ id: z.string().min(1).meta({ example: 'MU74' }) }),
          query: searchQuerySchema,
        },
        responses: {
          '200': { description: 'Hotel price data' },
          '400': { description: 'Invalid parameters or dates' },
          '502': { description: 'Upstream Ascenda API unavailable' },
        },
      },
    },

    '/api/webhooks/stripe': {
      post: {
        summary: 'Stripe webhook endpoint',
        tags: ['Webhooks'],
        description: 'Receives Stripe payment events. Verified via stripe-signature header.',
        parameters: [
          {
            in: 'header',
            name: 'stripe-signature',
            required: true,
            schema: { type: 'string', minLength: 1, description: 'Stripe webhook signature' },
          },
        ],
        requestBody: {
          content: { 'application/json': { schema: z.object({ type: z.string(), data: z.object({ object: z.object({ id: z.string() }) }) }) } },
        },
        responses: {
          '200': { description: 'Event received' },
          '400': { description: 'Missing or invalid stripe-signature header' },
          '401': { description: "Invalid or missing Stripe signature" },
        },
      },
    },
  },
})

const json = JSON.stringify(doc, null, 2)
import { writeFileSync } from 'node:fs'
writeFileSync(new URL('../openapi.json', import.meta.url), json)
console.log('OpenAPI spec written to openapi.json')

