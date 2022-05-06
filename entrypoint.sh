#! /usr/bin/env bash

set -euo pipefail

# xstep one is just to ensure you can build an image that will serve the app as static asset from node
# now need to also make sure it works in the dev environment

# 1. call python script, which will populate mongo
    # a. get into data dir: /usr/app/src/data
    # b. descend recursively in there, and everytime you find a dir containing these triples (matrix.mtx, features.tsv, barcodes.tsv), push it into db
        # will need os.walk for this
        # also, pathlib.Path is possibly very useful, esp Path.rglob: https://docs.python.org/3/library/pathlib.html#pathlib.Path.rglob
    # c. when you find labels.csv and cluster_tree.json, copy them into the react static assets dir
        # this is also where the preliminary prune would happen
# 2. nodemon (react app will be compiled as part of docker image build and moved into static directory)
# but for development, we can run in 2 containers and proxy in the requests to the api (so that it gets no static file requests)
    # in other words, the built image will serve the app as a static file, but in development we'll use the dev server for simplicity's sake
# this makes development much easier


# sample working command: docker run -it --rm -p 4422:4422 -v /home/conor/too-many-cells/out_tabula_muris/all_simple:/usr/app/node/static/files too-many-cells-js:latest
# note that port is hardcoded at runtime