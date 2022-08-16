#! /usr/bin/env bash

set -eo pipefail

# Simple wrapper script for generating the svg in "headless" mode via docker and saving on host filesystem.
# Calls /node/dist/exportTree.js within the container, binding the input file paths as volume mounts.
# Assumes that mongo database has already been provisioned, either by running ./start-and-load.sh or manually.
# Note that by default the user running the container process is `node`, which has UID 1000, please ensure that this user has the proper
# permissions to access the mounted files and directories; alternately, a different user can be configured to run the container
# using the --user argument to the docker run command or by passing arguments directly to the build command

build=true

if [[ $# < 8 ]]; then
    echo -e >&2 "USAGE: $0 
        --label-path /path/to/labels.csv  
        --tree-path /path/to/cluster_tree.json 
        --config-path /path/to/state-config.json 
        --out-path /path/to/save-file.svg 
        [--no-build] " && exit 1
fi

while [ ! -z $1 ]; do
    if [[ $1 == '--label-path' ]]; then 
        shift
        if [[ ! -f "${1}" ]]; then
           echo >&2 "${1} does not exist!" && exit 1
        fi
        host_label_path="${1}"
        target_label_path=/tmp/"$(basename "${host_label_path}")"

    elif [[ $1 == '--out-path' ]]; then
        shift
        host_out_dir="$(dirname "${1}")"
        if [[ ! -d "${host_out_dir}" ]]; then
           echo >&2 "${1} does not exist!" && exit 1
        fi
        target_out_dir=/tmp/results/"$(basename "${1}")"

    elif [[ $1 == '--no-build' ]]; then
        build=false
        shift
    
    elif [[ $1 == '--tree-path' ]]; then
        shift
        if [[ ! -f "${1}" ]]; then
           echo >&2 "${1} does not exist!" && exit 1
        fi
        host_tree_path="${1}"
        target_tree_path=/tmp/"$(basename "${host_tree_path}")"

    # passing in `-` tells node script to read config from stdin
    elif [[ $1 == '--config-path' ]]; then
        shift
        if [[ $1 == "-" ]]; then
            target_config_path=-
        elif [[ ! -f "${1}" ]]; then
            echo >&2 "${1} does not exist!" && exit 1
        else 
            host_config_path="${1}"
            target_config_path=/tmp/"$(basename "${host_config_path}")"

        fi
    else
        shift
    fi
done

# mount config file only if we're not reading from stdin
if [[ $target_config_path == '-' ]]; then
    config_volume_mount=' '
else
    config_volume_mount="-v "${host_config_path}":"${target_config_path}":ro"
fi

if [[ $build == true ]]; then
    docker-compose build node
fi

docker-compose -f docker-compose.prod.yaml \
    run --rm --entrypoint="node" \
    -v "${host_label_path}":"${target_label_path}":ro \
    -v "${host_tree_path}":"${target_tree_path}":ro \
    -v "${host_out_dir}":/tmp/results \
    $config_volume_mount \
    node dist/export-tree.js \
    --labelPath "${target_label_path}" \
    --treePath "${target_tree_path}" \
    --configPath="${target_config_path}" \
    --outPath "${target_out_dir}" 

# bash generate-svg.sh --label-path ~/too-many-cells/data/tabula_muris/all_simple/labels.csv --config-path ~/too-many-cells/data/tabula_muris/all_simple/state.json --tree-path ~/too-many-cells/data/tabula_muris/all_simple/cluster_tree.json --out-path ~/too-many-cells/data/tabula_muris/sample-output.svg --no-build
# echo '{"width": 2000, "filenameOverride": "somefile.svg"}' | bash generate-svg.sh --label-path ~/too-many-cells/data/tabula_muris/all_simple/labels.csv --config-path - -p