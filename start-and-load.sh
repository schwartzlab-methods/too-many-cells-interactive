# /usr/bin/env bash

# Simple wrapper script for running the browser program locally via docker
# Note that script will bind-mount <data_dir> into the container in readonly mode

set -eo pipefail

if [[ $# < 3 ]]; then
    echo >&2 "USAGE: $0 --data-dir /path/to/matrices --port 1234 [--no-init]" && exit 1
fi

debug=""

while [ ! -z "$1" ]; do
    if [[ "$1" == '--data-dir' ]]; then 
        shift
        data_dir=$1

    elif [[ "$1" == '--port' ]]; then
        shift
        port=$1

    elif [[ "$1" == '--no-init' ]]; then
        no_init=1
        shift

    elif [[ "$1" == '--debug' ]]; then
        debug="--debug"
        shift
    
    else
        shift
    fi
done

if ([[ -z $data_dir ]] && [[ -z $no_init ]]); then
    echo >&2 "please include the --data-dir argument or pass --no-init to skip loading!" && exit 1
fi

if [[ -n $data_dir ]] && [[ ! -d $data_dir ]] ; then
    echo >&2 "${data_dir} does not exist!" && exit 1
fi

if [[ -z $port ]]; then
    echo >&2 "please include the --port argument!" && exit 1
fi

if [[ -n $no_init ]]; then

    docker-compose -f docker-compose.prod.yaml run -p ${port}:3000 --rm node

else

    docker-compose build

    docker-compose -f docker-compose.prod.yaml run -p ${port}:3000 -v ${data_dir}:/usr/data:ro --rm node init $debug

fi
