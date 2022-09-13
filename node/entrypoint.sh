#! /usr/bin/env bash

set -euo pipefail

init=${1:-}
debug=${2:-}

while true; do
    if ! curl -s mongo:27017; then
        sleep 1
    else    
        break
    fi
done

if [[ $init == 'init' ]]; then
    python3 import-matrix.py $debug
fi

yarn run start