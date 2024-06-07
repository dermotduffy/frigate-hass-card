#!/bin/bash

# This script downloads css/js docs dependencies into locally served files.

CSS_URLS="
  https://cdn.jsdelivr.net/npm/docsify-themeable@0/dist/css/theme-simple.css
  https://cdn.jsdelivr.net/npm/docsify-themeable@0/dist/css/theme-simple-dark.css
"

JS_URLS="
  https://docsify-preview.vercel.app/dist/docsify.min.js
  https://docsify-preview.vercel.app/dist/plugins/gtag.min.js
  https://cdn.jsdelivr.net/npm/docsify-themeable@0/dist/js/docsify-themeable.min.js
  https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-yaml.min.js
  https://cdn.jsdelivr.net/npm/docsify@4/lib/plugins/search.js
  https://cdn.jsdelivr.net/npm/docsify/lib/plugins/zoom-image.min.js
  https://cdn.jsdelivr.net/npm/docsify-copy-code/dist/docsify-copy-code.min.js
  https://cdn.jsdelivr.net/npm/docsify-sidebar-collapse/dist/docsify-sidebar-collapse.min.js
"

for URL in $CSS_URLS; do
  echo "Fetching css $URL..."
  wget -q -O "docs/css/$(basename $URL)" "$URL"
done

for URL in $JS_URLS; do
  echo "Fetching js $URL..."
  wget -q -O "docs/js/$(basename $URL)" "$URL"
done
