#! /usr/bin/env bash

set -euo pipefail

CSV_PATH=$1

if ! [[ -e $CSV_PATH ]]; then
   echo >&2 "csv path not valid" && exit 1
fi

mongoimport --db=${MONGO_DB} \
    --collection=matrix \
    --type=csv \
    --columnsHaveTypes \
    --fields="feature.string(),feature_type.string(),id.string(),value.int32()" \
    --file=${CSV_PATH} \
    -u ${MONGO_INITDB_ROOT_USERNAME} \
    --password=${MONGO_INITDB_ROOT_PASSWORD} \
    --authenticationDatabase=admin


# query efficiency notes:
   # use a covered query, meaning that all fields are in the index, which means excluding _id
   # use regular index

# APOE count time before index: 30s
# Amount of time to create index: 2:15 note: this should be done before import!
# After index: instantaneous