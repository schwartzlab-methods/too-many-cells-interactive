#! /usr/bin/env bash

set -euo pipefail

tsc --watch
nodemon --watch dist/index.js

#don't use this, use this: https://stackoverflow.com/questions/37979489/how-to-watch-and-reload-ts-node-when-typescript-files-change