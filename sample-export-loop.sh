#! /usr/bin/env bash

set -euo pipefail

# note case sensitivity
genes=('Apoe' 'Serp1' 'Brca2')

#sample config json
json=$(cat <<EOF
{
    "features":[],
    "pruneState": [
        {
            "valuePruner": {
                "key":"minSize",
                "value":400
            }
        }
    ],
    "scales": {
        "branchsizeScaleRange":[0.01, 20],
        "pieScaleRange":[5, 20],
        "colorScale": { 
            "variant":"featureHiLos"
        }
    },
    "width":500,
    "fontsize": 30
}
EOF
)

for g in ${genes[@]}; do

    config=$(echo $json |  jq --arg g "$g" --arg override export-"$g".svg '
        setpath(["features"];[$g]) 
        | setpath(["filenameOverride"];$override)'
    )

    echo $config | bash generate-svg.sh \
        --no-build \
        --label-path ~/too-many-cells/data/tabula_muris/all_simple/labels.csv \
        --config-path - \
        --tree-path ~/too-many-cells/data/tabula_muris/all_simple/cluster_tree.json \
        --out-path ~/too-many-cells/data/tabula_muris/sample-output.svg

done