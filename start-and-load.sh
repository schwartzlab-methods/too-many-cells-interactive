#! /usr/bin/env bash

# Simple wrapper script for running the browser program locally via docker
# Note that script will bind-mount the provided file paths into the container in readonly mode

set -eo pipefail

if [[ $# < 7 ]]; then
    echo >&2 "USAGE: $0 --matrix-dir /path/to/matrices \
                        --tree-path /path/to/tree \
                        --label-path /path/to/labels \
                        --port 1234 \
                        [--debug]" && exit 1
fi

debug=""

while [ ! -z "$1" ]; do
    if [[ "$1" == '--matrix-dir' ]]; then 
        shift
        matrix_dir=$1

    elif [[ "$1" == '--tree-path' ]]; then 
        shift
        tree_path=$1

    elif [[ "$1" == '--label-path' ]]; then 
        shift
        label_path=$1

    elif [[ "$1" == '--port' ]]; then
        shift
        port=$1

    elif [[ "$1" == '--debug' ]]; then
        debug="--debug"
        shift
    
    else
        shift
    fi
done

if [[ ! -d "${matrix_dir}" ]] ; then
    echo >&2 "${matrix_dir} does not exist!" && exit 1
fi

if [[ ! -f "${tree_path}" ]] ; then
    echo >&2 "${tree_path} does not exist!" && exit 1
fi

if [[ ! -f "${label_path}" ]] ; then
    echo >&2 "${label_path} does not exist!" && exit 1
fi

if [[ -z $port ]]; then
    echo >&2 "please include the --port argument!" && exit 1
fi

docker-compose build

docker-compose -f docker-compose.prod.yaml run --rm -p ${port}:3000 \
    -v "${matrix_dir}":/usr/data/matrices:ro \
    -v "${tree_path}":/user/data \
    -v "${label_path}":/user/data \
    node init $debug

