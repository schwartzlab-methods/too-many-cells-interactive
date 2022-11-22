#! /usr/bin/env bash

# Simple wrapper script for running the browser program locally via docker
# Note that script will bind-mount the provided file paths into the container in readonly mode

set -eo pipefail

function help()
{
   echo "Start the TMC containers and mount label and tree files, optionally loading in matrix data."
   echo
   echo "Syntax: start-and-load.sh --tree-path --label-path --port [--matrix-path] [--debug]"
   echo "options:"
   echo "tree-path   /path/to/cluter_tree.json."
   echo "label-path  /path/to/labels.csv."
   echo "matrix-path /path/to/matrices (files in matrix-market format, can be nested and/or gzipped)."
   echo "port        <Port where webapp will listen>."
   echo "debug       Print data import details."
   echo
}

if [[ $# -lt 6 ]]; then
    help && exit 1
fi

debug=""
uid=$(id -u)
gid=$(id -g)

while [ -n "$1" ]; do
    if [[ "$1" == '--help' ]]; then
        help && exit 1

    elif [[ "$1" == '--matrix-dir' ]]; then
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

if [[ -n "${matrix_dir}" && ! -d "${matrix_dir}" ]] ; then
    echo >&2 "${matrix_dir} does not exist!" && exit 1
fi

if [[ ! -f "${tree_path}" ]] ; then
    echo >&2 "cluster_tree.json not found at ${tree_path}!" && exit 1
fi

if [[ ! -f "${label_path}" ]] ; then
    echo >&2 "labels.csv not found at ${label_path}!" && exit 1
fi

if [[ -z $port ]]; then
    echo >&2 "please include the --port argument!" && exit 1
fi

docker-compose -f docker-compose.prod.yaml build --build-arg UID=$uid --build-arg GID=$gid node

# start postgres in the background so we can exec commands to it
docker-compose -f docker-compose.prod.yaml up -d postgres

# make sure that postgres is up before proceeding
for i in {1..5}; do docker-compose exec postgres psql -U postgres -d tmc -c "SELECT NOW();" > /dev/null 2>&1 && break || sleep 2; done

if [[ -n "${matrix_dir}" ]]; then

    docker-compose -f docker-compose.prod.yaml run --rm \
        -v "${matrix_dir}":/usr/data/matrices:ro \
        node --init $debug

else
    # reset the database in case a prior run inserted data that's no longer needed
    docker-compose exec postgres psql -U postgres -d tmc -c 'TRUNCATE features;'
fi

docker-compose -f docker-compose.prod.yaml run --rm -p "${port}":3000 \
    -v "${tree_path}":/usr/app/static/files/cluster_tree.json:ro \
    -v "${label_path}":/usr/app/static/files/labels.csv:ro \
    node --prod
