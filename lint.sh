#!/usr/bin/env bash

# biome
#pnpm biome check --unsafe .
pnpm biome check --write --unsafe .

node_modules/.bin/prettier -w "**/*.md" "**/*.yml" "**/*.html" "**/*.scss"

pnpm eslint-check


# stylefmt for SCSS
# pnpm stylefmt --recursive '**/*.css'

# ruff
#uv run ruff check --fix .
#uv run ruff format .

# nginx
#find . -type f -name '*.conf' -path '*/nginx*' -exec nginxfmt -v {} +;

# taplo
taplo format
