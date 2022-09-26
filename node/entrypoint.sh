#! /usr/bin/env bash

set -eo pipefail

init=''
debug=''
prod=''

while [ ! -z "$1" ]; do
    if [[ "$1" == '--init' ]]; then 
        shift
        init=1

    elif [[ "$1" == '--debug' ]]; then 
        shift
        debug='--debug'

    elif [[ "$1" == '--prod' ]]; then 
        shift
        prod=1
    else
        shift
    fi
done

if [[ -n $init ]]; then
    node ./dist/importMatrix.js $debug
    exit 0
fi

if [[ -n $prod ]]; then
    yarn run start-prod
else
    yarn run start
fi