#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://tgbot-3cm.pages.dev}"
BASE_URL="${BASE_URL%/}"

html="$(curl -sS "${BASE_URL}/")"

mapfile -t assets < <(
  echo "${html}" \
    | rg -o 'src="[^"]+\.js[^"]*"|href="[^"]+\.css[^"]*"' \
    | sed -E 's/(src|href)="([^"]+)"/\2/' \
    | head -n 3
)

if [[ "${#assets[@]}" -eq 0 ]]; then
  echo "No JS/CSS assets found on ${BASE_URL}/" >&2
  exit 1
fi

echo "Checking assets from ${BASE_URL}/:"
printf ' - %s\n' "${assets[@]}"

for asset in "${assets[@]}"; do
  if [[ "${asset}" =~ ^https?:// ]]; then
    url="${asset}"
  else
    asset="${asset#./}"
    url="${BASE_URL}/${asset#/}"
  fi

  status="$(curl -sS -o /dev/null -w "%{http_code}" "${url}")"
  if [[ "${status}" != "200" ]]; then
    echo "Unexpected status ${status} for ${url}" >&2
    exit 1
  fi

  content_type="$(
    curl -sSI "${url}" \
      | rg -i '^content-type:' \
      | head -n 1 \
      | tr -d '\r'
  )"

  body_head="$(curl -sS "${url}" | head -c 200)"
  if [[ "${body_head}" == "<"* ]]; then
    echo "Asset ${url} returned HTML (starts with '<')." >&2
    exit 1
  fi

  if [[ "${asset}" == *.css* ]]; then
    if ! echo "${content_type}" | rg -qi 'text/css'; then
      echo "Unexpected Content-Type for CSS ${url}: ${content_type}" >&2
      exit 1
    fi
  fi

  if [[ "${asset}" == *.js* ]]; then
    if ! echo "${content_type}" | rg -qi 'application/javascript|text/javascript|application/x-javascript'; then
      echo "Unexpected Content-Type for JS ${url}: ${content_type}" >&2
      exit 1
    fi
  fi
done

echo "OK: JS/CSS assets look valid."
