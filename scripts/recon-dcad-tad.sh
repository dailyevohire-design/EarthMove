#!/usr/bin/env bash
# scripts/recon-dcad-tad.sh
#
# Probe Texas County Appraisal Districts (DCAD/TAD/HCAD/TCAD) to classify
# endpoint shape (REST API / HTML scrape / WAF-blocked) before tx_assessor
# scraper commit. Output goes to /tmp/recon-tx-assessor.log + stdout.

set -u

LOG=/tmp/recon-tx-assessor.log
: > "$LOG"

UA='Mozilla/5.0 (X11; Linux x86_64) earthmove-recon/1.0'

probe() {
  local label="$1"
  local url="$2"
  {
    echo
    echo "═══ $label ═══"
    echo "URL: $url"
    echo "--- HEADERS ---"
    curl -sS -L -I -A "$UA" --max-time 15 "$url" 2>&1 || echo "(HEAD failed)"
    echo "--- BODY (first 2KB) ---"
    curl -sS -L -A "$UA" --max-time 15 "$url" 2>&1 | head -c 2048
    echo
    echo "--- BODY END ---"
  } | tee -a "$LOG"
}

probe "DCAD landing"                   "https://www.dallascad.org/"
probe "DCAD owner search page"         "https://www.dallascad.org/SearchOwner.aspx"
probe "DCAD ArcGIS REST root"          "https://gis.dallascad.org/arcgis/rest/services"
probe "TAD landing"                    "https://www.tad.org/"
probe "TAD property search"            "https://www.tad.org/property-search/"
probe "TAD ArcGIS REST root"           "https://gis.tad.org/arcgis/rest/services"
probe "HCAD landing (Houston bonus)"   "https://hcad.org/"
probe "TCAD landing (Travis bonus)"    "https://www.traviscad.org/"

{
  echo
  echo "═══ Classification key ═══"
  echo "Full log: $LOG"
  echo
  echo "  • 200 OK + Content-Type: application/json    → REST API, easy"
  echo "  • 200 OK + text/html + <form action=...>     → server-side scrape"
  echo "  • 403/503 + cf-ray / x-amzn-waf / set-cookie → WAF blocking"
  echo "  • ArcGIS REST JSON                           → ESRI FeatureServer pattern"
} | tee -a "$LOG"
