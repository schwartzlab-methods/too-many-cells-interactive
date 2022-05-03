#! /usr/bin/env bash

set -euo pipefail

tsc --watch
nodemon --watch dist/index.js