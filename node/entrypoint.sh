#! /usr/bin/env bash

set -euo pipefail

INIT=${1:-}

while true; do
    if ! curl -s mongo:27017; then
        sleep 1
    else    
        break
    fi
done

if [[ $INIT == 'init' ]]; then
    python3 import-matrix.py
fi

yarn run start