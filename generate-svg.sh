#! /usr/bin/env bash

set -eo pipefail

# Simple wrapper script for generating the svg in "headless" mode via docker and saving on host filesystem.
# Calls /node/dist/exportTree.js within the container, binding the input file paths as volume mounts.
# Assumes the database has already been provisioned, either by running ./start-and-load.sh or manually.
# Note that by default the user running the container process is `node`, which has UID 1000, please ensure that this user has the proper
# permissions to access the mounted files and directories; alternately, a different user can be configured to run the container
# using the --user argument to the docker run command or by passing the corresponding arguments (`ARG`s) to the build command.

# Examples:
# bash generate-svg.sh --label-path ~/too-many-cells/data/tabula_muris/all_simple/labels.csv --config-path ~/too-many-cells/data/tabula_muris/all_simple/state.json --tree-path ~/too-many-cells/data/tabula_muris/all_simple/cluster_tree.json --out-path ~/too-many-cells/data/tabula_muris/sample-output.svg --no-build
# echo '{"width": 2000, "filenameOverride": "somefile.svg"}' | bash generate-svg.sh --config-path - ....


build=true
docker_args=()
script_args=()
uid=$(id -u)
gid=$(id -g)


if [[ $# -lt 7 ]]; then
    echo -e >&2 "USAGE: $0 
        --label-path /path/to/labels.csv  
        --tree-path /path/to/cluster_tree.json 
        --config-path /path/to/state-config.json 
        --out-path /path/to/save-file.svg 
        [--annotation-path /path/to/annotation.csv]
        [--no-build] " && exit 1
fi

while [ -n "$1" ]; do
    if [[ $1 == '--label-path' ]]; then 
        shift
        if [[ ! -f "${1}" ]]; then
           echo >&2 "${1} does not exist!" && exit 1
        fi
        target_label_path=/tmp/"$(basename "${1}")"
        docker_args+=("-v" "${1}:${target_label_path}:ro")
        script_args+=("--labelPath" "${target_label_path}")

    elif [[ $1 == '--out-path' ]]; then
        shift
        host_out_dir="$(dirname "${1}")"
        if [[ ! -d "${host_out_dir}" ]]; then
           echo >&2 "${1} does not exist!" && exit 1
        fi
        target_out_dir=/tmp/results/"$(basename "${1}")"
        docker_args+=("-v" "${host_out_dir}:/tmp/results")
        script_args+=("--outPath" "${target_out_dir}")

    elif [[ $1 == '--tree-path' ]]; then
        shift
        if [[ ! -f "${1}" ]]; then
           echo >&2 "${1} does not exist!" && exit 1
        fi
        target_tree_path=/tmp/"$(basename "${1}")"
        docker_args+=("-v" "${1}:${target_tree_path}:ro")
        script_args+=("--treePath" "${target_tree_path}")

    # passing in `-` tells node script to read config from stdin, equals sign required
    elif [[ $1 == '--config-path' ]]; then
        shift
        if [[ $1 == "-" ]]; then
            script_args+=("--configPath=-")
        elif [[ ! -f "${1}" ]]; then
            echo >&2 "${1} does not exist!" && exit 1
        else 
            target_config_path=/tmp/"$(basename "${1}")"
            docker_args+=("-v" "${1}:${target_config_path}:ro")
            script_args+=("--configPath" "${target_config_path}")
        fi

    elif [[ $1 == '--annotation-path' ]]; then
        shift
        if [[ ! -f "${1}" ]]; then
           echo >&2 "${1} does not exist!" && exit 1
        fi
        target_annotation_path=/tmp/results/"$(basename "${1}")"

        docker_args+=("-v" "${1}:${target_annotation_path}:ro")
        script_args+=("--annotation-path" "${target_annotation_path}")

    elif [[ $1 == '--no-build' ]]; then
        build=false
        shift

    else
        shift
    fi
done

if [[ $build == true ]]; then
    docker-compose build node
fi

set -- "${docker_args[@]}" node dist/exportTree.js "${script_args[@]}"

docker-compose -f docker-compose.prod.yaml \
    run --rm --entrypoint="node" "$@"

