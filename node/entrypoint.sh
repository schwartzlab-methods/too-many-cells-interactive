#! /usr/bin/env bash

set -eo pipefail

init=false
debug=''
prod=false

while [ ! -z "$1" ]; do
    if [[ "$1" == '--init' ]]; then 
        shift
        init=true

    elif [[ "$1" == '--debug' ]]; then 
        shift
        debug='--debug'

    elif [[ "$1" == '--prod' ]]; then 
        shift
        prod=true
    else
        shift
    fi
done

if [[ $init ]]; then
    node ./dist/importMatrix.js $debug
fi

if [[ prod ]]; then
    yarn run start-prod
else
    yarn run start
fi