# /usr/bin/env bash

set -eo pipefail

if [[ $# < 2 ]]; then
    echo >&2 "USAGE: $0 --data-dir /path/to/matrices" && exit 1
fi

DATA_DIR=${2:-}

if [[ ! -d $DATA_DIR ]]; then
    echo >&2 "${DATA_DIR} is not a valid directory!" && exit 1
fi

#build the node image
docker-compose build node

#todo: build script, since the version on the image, like node_modules, will get wiped out too if not present on host when volume mounts
# in general should move to a switch-like entrypoint script

#install react dependencies
docker-compose run --rm --entrypoint="yarn" react

#bring up mongo
docker-compose up -d mongo

#load data into mongo
docker-compose run -v ${DATA_DIR}:/usr/data --entrypoint="python3 import-matrix.py" --rm node

#start remaining services
docker-compose up