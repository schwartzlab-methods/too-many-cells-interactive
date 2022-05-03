#! /usr/bin/env bash

set -euo pipefail


# 1. call python script, which will populate mongo
    # a. get into data dir: /usr/app/src/data
    # b. descend recursively in there, and everytime you find a dir containing these triples (matrix.mtx, features.tsv, barcodes.tsv), push it into db
    # c. when you find labels.csv and cluster_tree.json, copy them into the react static assets dir
        # this is also where the preliminary prune would happen
# 2. nodemon (react app will be compiled as part of docker image build and moved into static directory)
# but for development, we can run in 2 containers and proxy in the requests to the api (so that it gets no static file requests)
# this makes development much easier