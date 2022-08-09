# /usr/bin/env bash

# Simple wrapper script for running the browser program locally via docker
# Note that script will bind-mount <data_dir> into the container in readonly mode

set -eo pipefail

if [[ $# < 4 ]]; then
    echo >&2 "USAGE: $0 --data-dir /path/to/matrices --port 1234" && exit 1
fi

while [ ! -z "$1" ]; do
    if [[ "$1" == '--data-dir' ]]; then 
        shift
        data_dir=$1

    elif [[ "$1" == '--port' ]]; then
        shift
        port=$1
    
    else
        shift
    fi
done

if [[ ! -d $data_dir ]]; then
    echo >&2 "${data_dir} does not exist!" && exit 1
fi

if [[ -z $port ]]; then
    echo >&2 "please include --port argument!" && exit 1
fi

docker-compose build

docker-compose -f docker-compose.prod.yaml run -p ${port}:3000 -v ${data_dir}:/usr/data:ro --rm node init