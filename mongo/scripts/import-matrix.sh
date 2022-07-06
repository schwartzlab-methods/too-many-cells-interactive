#! /usr/bin/env bash

set -euo pipefail

CSV_PATH=$1

if ! [[ -e $CSV_PATH ]]; then
   echo >&2 "csv path not valid" && exit 1
fi

mongoimport --db=${MONGO_DB} \
    --collection=features \
    --type=csv \
    --columnsHaveTypes \
    --fields="feature.string(),feature_type.string(),id.string(),value.int32()" \
    --file=${CSV_PATH} \
    -u ${MONGO_INITDB_ROOT_USERNAME} \
    --password=${MONGO_INITDB_ROOT_PASSWORD} \
    --authenticationDatabase=admins
