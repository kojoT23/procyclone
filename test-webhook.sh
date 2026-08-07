#!/bin/bash
# Simulates a Fleepystore order hitting your local Shorewinds webhook.
# Run this from anywhere — it doesn't need to be inside the project.
#
# BEFORE RUNNING:
#   1. Make sure your backend is running (cd backend && node src/index.js)
#   2. Set the SAME secret in backend/.env as used below:
#        FLEEPYSTORE_WEBHOOK_SECRET=dev-test-secret-change-me
#   3. Restart the backend after adding that .env line

SECRET="dev-test-secret-change-me"
URL="http://localhost:5001/api/webhooks/fleepystore"

# Adjust these to match REAL data in your DB before testing:
#   - delivery_zone_name must match an existing, active delivery_zones.name
#   - items[].sku must match a real, active product's sku with enough stock
#   - external_order_id must be unique each time you test (or you'll get
#     the idempotent "already received" response on a second run)
BODY=$(cat <<'EOF'
{
  "external_order_id": "FLPY-TEST-0001",
  "customer": {
    "name": "Test Customer",
    "phone": "0244000001",
    "email": "test@example.com",
    "address": "1 Test Street, Accra"
  },
  "items": [
    { "sku": "REPLACE-WITH-REAL-SKU", "quantity": 1, "unit_price": 10.00 }
  ],
  "delivery_zone_name": "REPLACE-WITH-REAL-ZONE-NAME",
  "delivery_address": "1 Test Street, Accra",
  "payment_method": "momo",
  "momo_reference": "MP-TEST-REF-0001",
  "notes": "Webhook test order"
}
EOF
)

# Compute HMAC-SHA256 signature over the exact body bytes
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

echo "Sending test order to $URL ..."
echo ""

curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-fleepystore-signature: $SIGNATURE" \
  -d "$BODY" | python3 -m json.tool 2>/dev/null || echo "(response was not valid JSON — check the raw output above)"
