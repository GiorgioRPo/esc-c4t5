# Feature 2 — Hotel Search Results
# Integration tests for the backend proxy endpoints that power hotel search.
# Requires: backend running on :3000 with a valid ASCENDA_API_URL, and network access.
# Uses destination_id=RsBU 


# Static hotel list  (GET /api/hotels)
# 1. A valid destination returns a non-empty list of hotels.
GET http://localhost:3000/api/hotels?destination_id=RsBU
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$" count > 0
jsonpath "$[0].id" exists
jsonpath "$[0].name" exists

# 2. Missing destination_id is rejected with a 400 and an error message.
GET http://localhost:3000/api/hotels
HTTP 400
[Asserts]
jsonpath "$.error" exists


# Live prices  (GET /api/hotels/prices)

# 3. A valid search returns the Ascenda prices envelope.
GET http://localhost:3000/api/hotels/prices?destination_id=RsBU&checkin=2026-10-01&checkout=2026-10-07&guests=2&currency=SGD&country_code=SG
HTTP 200
[Asserts]
jsonpath "$.completed" isBoolean
jsonpath "$.currency" exists
jsonpath "$.hotels" exists

# 4. Missing required params (only destination_id given) is rejected.
GET http://localhost:3000/api/hotels/prices?destination_id=RsBU
HTTP 400
[Asserts]
jsonpath "$.error" exists


# CORS  (the frontend calls :3000 from the Vite origin :5173)
# 5. Preflight from the frontend origin is allowed.
OPTIONS http://localhost:3000/api/hotels
Origin: http://localhost:5173
Access-Control-Request-Method: GET
HTTP 204
[Asserts]
header "Access-Control-Allow-Origin" == "http://localhost:5173"
