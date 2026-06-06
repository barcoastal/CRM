#!/bin/bash
# Wrapper that always uses 16GB heap so chunked migrations don't OOM at merge phase.
export NODE_OPTIONS="--max-old-space-size=16384"
exec npx tsx "$(dirname "$0")/migrate-sf-full.ts" "$@"
