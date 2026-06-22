#!/usr/bin/env bash
# Loads the sample data end-to-end against a running app:
#   upload (-> DynamoDB) -> normalize (-> Aurora) -> forecast (-> Claude)
# Usage: ./seed.sh            (defaults to localhost + company "acme")
#        BASE_URL=https://your-app.vercel.app COMPANY=acme ./seed.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COMPANY="${COMPANY:-acme}"

echo "==> Uploading CSVs to $BASE_URL for company '$COMPANY'"
for pair in "sales:seed/sales.csv" "inventory:seed/inventory.csv" "invoice:seed/invoices.csv"; do
  type="${pair%%:*}"; file="${pair##*:}"
  echo "  - $type ($file)"
  curl -sS -X POST "$BASE_URL/api/upload" \
    -F "companyId=$COMPANY" -F "type=$type" -F "file=@$file" | sed 's/^/    /'
  echo
done

echo "==> Normalizing DynamoDB -> Aurora"
curl -sS -X POST "$BASE_URL/api/normalize" \
  -H "Content-Type: application/json" \
  -d "{\"companyId\":\"$COMPANY\"}" | sed 's/^/  /'
echo

echo "==> Running 90-day cash flow forecast (Claude)"
curl -sS -X POST "$BASE_URL/api/forecast" \
  -H "Content-Type: application/json" \
  -d "{\"companyId\":\"$COMPANY\",\"openingCash\":50000}" | sed 's/^/  /'
echo
echo "==> Done. Open $BASE_URL  (use companyId '$COMPANY' on the pages)."
