#!/usr/bin/env bash
BASE=${BASE:-http://localhost:3000}
TOKEN=${TOKEN:-$VERIFY_TOKEN}
TENANT_ID="$1"
hdr(){ if [ -n "$TOKEN" ]; then echo "-H Authorization: Bearer $TOKEN"; fi; }
json(){ jq -r .; }

echo "# health"; curl -s $BASE/health | json
if [ -z "$TENANT_ID" ]; then echo "Usage: TENANT_ID required as first arg"; exit 1; fi

echo "# companies list";  curl -s $BASE/companies -H "x-tenant-id: $TENANT_ID" $(hdr) | json
echo "# create company";  curl -s $BASE/companies -H "x-tenant-id: $TENANT_ID" -H "Content-Type: application/json" $(hdr) \
  -d "{\"companyId\":\"GISA$RANDOM\",\"legalName\":\"Curl GmbH\",\"address\":\"Curlstrasse 1\"}" | json
echo "# OUs list";        curl -s $BASE/ous -H "x-tenant-id: $TENANT_ID" $(hdr) | json
echo "# create OU";       curl -s $BASE/ous -H "x-tenant-id: $TENANT_ID" -H "Content-Type: application/json" $(hdr) \
  -d '{"name":"Curl OU"}' | json
