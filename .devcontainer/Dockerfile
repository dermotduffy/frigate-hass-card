FROM ghcr.io/felipecrs/devcontainer:2

RUN --mount=type=bind,source=package.json,target=/tmp/package.json \
  retry --tries 3 --sleep 15s -- volta install \
  "node@$(jq -er .volta.node /tmp/package.json)" \
  "yarn@$(jq -er .volta.yarn /tmp/package.json)"
