# /usr/bin/env bash

set -eo pipefail

PORT=8080

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


# this will override volume mount in compose [actually i don't think it will] -- no it won't, so we won't use it in the compose
# todo: need to get ride of custom internal port, should always be 3000
# overriding the entrypoint will also be an issue -- will it work here? if we remove from compose local dev will be janky
docker-compose run -p ${PORT}:4443 -v ${DATA_DIR}:/usr/data --rm node init 