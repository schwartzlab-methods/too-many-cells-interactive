# /usr/bin/env bash

set -eo pipefail

# ./start-and-load.sh --data-dir ~/too-many-cells/data/tabula_muris --port 1234

if [[ $# < 4 ]]; then

    echo >&2 "USAGE: $0 --data-dir /path/to/matrices --port 1234" && exit 1
fi

while [ ! -z "$1" ]; do
    if [[ "$1" == '--data-dir' ]]; then 
        shift
        DATA_DIR=$1

    elif [[ "$1" == '--port' ]]; then
        shift
        PORT=$1
    
    else
        shift
    fi
done

if [[ ! -d $DATA_DIR ]]; then
    echo >&2 "${DATA_DIR} does not exist!" && exit 1
fi

if [[ -z $PORT ]]; then
    echo >&2 "please include --port argument!" && exit 1
fi

docker-compose build

docker-compose run -p ${PORT}:3000 -v ${DATA_DIR}:/usr/data:ro --rm node init