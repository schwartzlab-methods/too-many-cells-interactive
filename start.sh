# /usr/bin/env bash

set -eo pipefail

# Simple script to start container with data directory mounted and optional port specified
# assumes that container is already pulled and built and is called too-many-cells-js:latest
# user must pass in --data-dir argument with absolute path of directory containing files called cluster_tree.json and labels.csv
# Example: `bash start.sh --port 9090 --data-dir /home/conor/too-many-cells-js/js/src/data`

PORT=8080

while [ ! -z "$1" ]; do
    echo $1
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

docker run --rm -it -v $DATA_DIR:/usr/app/src/data -p ${PORT}:8080 too-many-cells-js:latest