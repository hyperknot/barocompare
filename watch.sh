#!/usr/bin/env bash

# Kill anything on our ports before starting
lsof -ti:8012 | xargs kill -9
lsof -ti:3012 | xargs kill -9

cd fe && pnpm dev
