import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

import { JSDOM } from 'jsdom';
import yargs from 'yargs';
import concatStream from 'concat-stream';
import mongoose from 'mongoose';

import { Feature } from '../src/models';
import Tree, {
    d3select,
    TreeContext,
} from '../../react/src/Visualizations/Tree';
import { transformData } from '../../react/src/prepareData';
import {
    addGray,
    calculateOrdinalColorScaleRangeAndDomain,
    calculateTreeLayout,
    getEntries,
    getExtent,
    getKeys,
    getMedian,
    getScaleCombinations,
    interpolateColorScale,
    runPrunes,
} from '../../react/src/util';
import {
    buildFeatureColorScale,
    buildFeatureLinearScale,
    buildLabelColorFunction,
    getFeatureAverage,
    getLabelColor,
    makeLinearScale,
    makeOrdinalScale,
} from '../../react/src/hooks/useScale';
import { attachLegend } from '../../react/src/downloadImage';
import { TMCHiearchyNode, TMCHierarchyPointNode } from '../../react/src/types';
import { StateExport } from '../../react/src/hooks/useExportState';
import {
    addFeaturesToCells,
    getFeatureGradientDomain,
    updateFeatureCounts,
    updatefeatureHiLos,
} from '../../react/src/hooks/usePrunedTree';
import { ToggleableDisplayElements } from '../../react/src/redux/displayConfigSlice';

type StateConfig = StateExport & { filenameOverride?: string };
type ChartConfig = Required<StateExport> & { filenameOverride?: string };

const argv = yargs(process.argv.slice(2))
    .usage('Usage: $0 <cmd> [options]')
    .command('render-tree', 'renders the tree', {
        labelPath: {
            description: 'Path to the labels.csv file',
            type: 'string',
            nargs: 1,
        },
        treePath: {
            description: 'Path to the cluster_tree.json file',
            type: 'string',
            nargs: 1,
        },
        configPath: {
            description: 'Path to the display_config.json file',
            type: 'string',
            nargs: 1,
        },
        outPath: {
            description: 'path to where the .svg file should be saved',
            type: 'string',
            nargs: 1,
        },
    })
    .demandOption(['labelPath', 'treePath', 'configPath', 'outPath']).argv;

const parse = (buf: string) => {
    if (!buf) {
        throw Error('file is empty!!');
    }
    return JSON.parse(buf);
};

const outPath = (argv as { [key: string]: string }).outPath;

const labels = readFileSync((argv as { [key: string]: string }).labelPath, {
    encoding: 'utf-8',
});

const clusterTree = JSON.parse(
    readFileSync((argv as { [key: string]: string }).treePath, {
        encoding: 'utf-8',
    })
);

const getFeatureMap = async (features: string[]) => {
    const featureMap: Record<string, Record<string, number>> = {};
    for (const feature of features) {
        const res = await Feature.find({ feature });
        featureMap[feature] = {};
        for (const f of res) {
            featureMap[feature][f.id] = f.value;
        }
    }
    return featureMap;
};

/**
 * If features are present, either because we have a feature scale or a label scale with opacity,
 * add features to cells and annotate nodes as required for scales to render appropriately.
 */
const addFeatures = async (state: ChartConfig, nodes: TMCHiearchyNode) => {
    const { variant: scaleType } = state.scales!.colorScale!;

    if (
        state.features.length &&
        (scaleType !== 'labelCount' ||
            (scaleType === 'labelCount' &&
                state.optionalDisplayElements.showFeatureOpacity))
    ) {
        await mongoose.connect(process.env.MONGO_CONNECTION_STRING!);
        const featureMap = await getFeatureMap(state.features);
        addFeaturesToCells(nodes, featureMap);

        if (scaleType === 'featureHiLos') {
            const thresholds =
                (state.scales.colorScale?.featureHiLoThresholds as Record<
                    string,
                    number
                >) || {};
            getEntries(featureMap).forEach(([k, v]) => {
                if (!thresholds[k]) {
                    thresholds[k] = getMedian(Object.values(v));
                }
            });
            updatefeatureHiLos(nodes, thresholds, state.features);
        } else {
            updateFeatureCounts(nodes, state.features);
        }
    }

    return nodes;
};

// run prunes (generally done after adding features but before calculating scales)
const pruneAndCalculateLayout = (
    state: ChartConfig,
    nodes: TMCHiearchyNode
) => {
    const pruned = state.pruneState.length
        ? runPrunes(state.pruneState.length - 1, state.pruneState, nodes)
        : nodes;

    const visibleNodes = calculateTreeLayout(pruned, state.width);
    return visibleNodes;
};

/* Calculate scales based on visible nodes and state config */
const getScale = (nodes: TMCHierarchyPointNode, state: ChartConfig) => {
    const { variant: scaleType } = state.scales.colorScale!;

    if (scaleType === 'labelCount') {
        let linearScale;

        let { labelRange, labelDomain } = state.scales.colorScale || {};

        if (!labelDomain || !labelRange) {
            const res = calculateOrdinalColorScaleRangeAndDomain(
                'labelCount',
                nodes
            );
            labelRange = res.range;
            labelDomain = res.domain;
        }

        const opacityVisible = state.optionalDisplayElements.showFeatureOpacity;

        if (opacityVisible) {
            updateFeatureCounts(nodes, state.features);
            linearScale = buildFeatureLinearScale(
                getFeatureGradientDomain(nodes, state.features)
            );
        }

        const scale = makeOrdinalScale(labelRange, labelDomain);
        const scaleFunction = buildLabelColorFunction(
            state.features,
            scale,
            opacityVisible,
            linearScale
        );
        return { scale, scaleFunction };
    } else if (scaleType === 'featureHiLos') {
        const domain = state.scales.colorScale?.featureHiLoDomain?.length
            ? state.scales.colorScale.featureHiLoDomain
            : getScaleCombinations(state.features);
        const range = state.scales.colorScale?.featureHiLoRange?.length
            ? state.scales.colorScale.featureHiLoRange
            : addGray(domain, interpolateColorScale(domain));
        const scale = makeOrdinalScale(range, domain);
        const scaleFunction = (node: TMCHiearchyNode) => {
            return getLabelColor(scale, node, 'featureHiLos').toString();
        };
        return { scale, scaleFunction };
    } else {
        const linearScale = buildFeatureLinearScale(
            getFeatureGradientDomain(nodes, state.features)
        );

        const scale = buildFeatureColorScale(
            '#D3D3D3',
            state.scales.colorScale?.featureGradientColor || '#E41A1C',
            linearScale
        );

        const scaleFunction = (node: TMCHiearchyNode) => {
            const featureAverage = getFeatureAverage(node, state.features);
            return scale(featureAverage);
        };

        return { scale, scaleFunction };
    }
};

/* Return the scales needed for the graphic */
const getTreeScales = (
    scaleFunction: (node: TMCHiearchyNode) => string,
    state: ChartConfig,
    nodes: TMCHiearchyNode
) => ({
    branchSizeScale: makeLinearScale(
        state.scales.branchsizeScaleRange || [0.01, 20],
        getExtent(nodes.descendants().map(d => +(d.value || 0)))
    ),
    colorScaleWrapper: scaleFunction!,
    pieScale: makeLinearScale(
        state.scales.pieScaleRange || [5, 20],
        getExtent(nodes.leaves().map(d => d.value!))
    ),
});

/* Draw the tree and write to the output directory */
const saveTree = async (state: ChartConfig, nodes: TMCHiearchyNode) => {
    const dom = new JSDOM(`<!DOCTYPE html><body></body></html>`);

    const selection = d3select(dom.window.document).select('body');

    const { variant: scaleType } = state.scales!.colorScale!;
    await addFeatures(state, nodes);
    const visibleNodes = pruneAndCalculateLayout(state, nodes);
    const { scale, scaleFunction } = getScale(visibleNodes, state);
    const treeScales = getTreeScales(scaleFunction, state, nodes);

    const context: TreeContext = {
        displayContext: {
            clickPruneHistory: [],
            colorScaleKey: scaleType!,
            scales: treeScales,
            toggleableFeatures: Object.assign(
                defaultToggleableFeatures,
                state?.optionalDisplayElements || {}
            ),
            visibleNodes,
            width: state.width,
        },
    };
    const RadialTree = new Tree(context, selection as any, true);

    RadialTree.transitionTime = 0;

    RadialTree.render();

    attachLegend(selection.select('svg'), scale, state.fontsize);

    selection
        .select('svg')
        .attr('version', '1.1')
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('width', state.width)
        .attr('height', state.width);

    let savePath = outPath;

    if (state.filenameOverride) {
        savePath = path.join(path.dirname(outPath), state.filenameOverride);
    }

    //need one tick for the transitions to complete
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(writeFileSync(savePath, selection.html()));
        });
    });
};

/* validation and defaults */

const OPTIONAL_DISPLAY_ELEMENTS: (keyof ToggleableDisplayElements)[] = [
    'distanceVisible',
    'nodeCountsVisible',
    'nodeIdsVisible',
    'piesVisible',
    'showFeatureOpacity',
    'strokeVisible',
];

const validateRange = (range: any) =>
    Array.isArray(range) &&
    range.every(n => typeof n === 'number') &&
    range.length == 2;

const validateScales = (scales: ChartConfig['scales']) => {
    let errors = '';
    if (!scales) {
        return errors;
    }
    const { branchsizeScaleRange, pieScaleRange, colorScale } = scales;

    if (!validateRange(branchsizeScaleRange)) {
        errors +=
            'branchsizeScaleRange property must be a number array of length 2!\n';
    }

    if (!validateRange(pieScaleRange)) {
        errors +=
            'pieScaleRange property must be a number array of length 2!\n';
    }

    if (colorScale) {
        const { variant } = colorScale;
        if (variant === 'featureCount') {
            if (
                colorScale.featureGradientColor &&
                typeof colorScale.featureGradientColor !== 'string'
            ) {
                errors += 'featureGradientColor must be a string!\n';
            }
        } else if (variant === 'featureHiLos') {
            const { featureHiLoDomain, featureHiLoRange } = colorScale;
            const rangeDomainLength = [
                featureHiLoDomain,
                featureHiLoRange,
            ].filter(Boolean).length;
            if (rangeDomainLength) {
                if (rangeDomainLength < 2) {
                    errors +=
                        'featureHiLoDomain and featureHiLoRange must be specified!\n';
                }
                if (featureHiLoDomain?.length !== featureHiLoRange?.length) {
                    errors +=
                        'featureHiLoDomain and featureHiLoRange must have the same length!\n';
                }
            }
        } else if (variant === 'labelCount') {
            const { labelDomain, labelRange } = colorScale;
            const rangeDomainLength = [labelDomain, labelRange].filter(
                Boolean
            ).length;
            if (rangeDomainLength) {
                if (rangeDomainLength < 2) {
                    errors += 'labelDomain and labelRange must be specified!\n';
                }
                if (labelDomain?.length !== labelRange?.length) {
                    errors +=
                        'labelDomain and labelRange must have the same length!\n';
                }
            }
        } else {
            errors += `Unknown color scale ${variant}!\n`;
        }
        return errors;
    }
};

const validateInput = (config: ChartConfig) => {
    let errors = '';
    if (!config.features.every(f => typeof f === 'string')) {
        errors += 'Features must be a JSON array of strings!\n';
    }
    const unknownOptions = getKeys(config.optionalDisplayElements).filter(
        o => !OPTIONAL_DISPLAY_ELEMENTS.includes(o)
    );
    if (unknownOptions.length) {
        errors += `Unrecognized optional display elements: ${unknownOptions.join(
            ', '
        )}!\n`;
    }
    errors += validateScales(config.scales);
    return errors;
};

const defaultToggleableFeatures = {
    distanceVisible: false,
    nodeCountsVisible: false,
    nodeIdsVisible: false,
    piesVisible: true,
    showFeatureOpacity: false,
    strokeVisible: false,
};

const defaultScales: StateExport['scales'] = {
    branchsizeScaleRange: [0.01, 20],
    colorScale: {
        variant: 'labelCount',
    },
    pieScaleRange: [5, 20],
};

const provideDefaults = (state: StateConfig): ChartConfig => {
    const config = {} as ChartConfig;

    config.filenameOverride = state.filenameOverride;
    config.features = state.features ?? [];
    config.optionalDisplayElements = Object.assign(
        defaultToggleableFeatures,
        state?.optionalDisplayElements || {}
    );
    config.pruneState = state.pruneState ?? [];
    config.width = state.width ?? 1000;
    config.scales = state.scales ?? {};
    config.scales.branchsizeScaleRange =
        config.scales.branchsizeScaleRange ??
        defaultScales.branchsizeScaleRange;
    config.scales.pieScaleRange =
        config.scales.pieScaleRange ?? defaultScales.pieScaleRange;
    config.scales.colorScale = config.scales.colorScale ?? {};
    config.scales.colorScale.variant =
        config.scales.colorScale.variant ?? defaultScales.colorScale?.variant;

    config.fontsize = state.fontsize ?? 20;

    return config;
};

/* If state config was passed as stdin (and --config switch was `--config=-`) read from there, otherwise read from file */
const getState = async (): Promise<StateConfig> =>
    new Promise(resolve => {
        (argv as { [key: string]: string }).configPath === '-'
            ? process.stdin.pipe(
                  concatStream({ encoding: 'string' }, (arg: string) =>
                      resolve(parse(arg))
                  )
              )
            : resolve(
                  parse(
                      readFileSync(
                          (argv as { [key: string]: string }).configPath,
                          {
                              encoding: 'utf-8',
                          }
                      )
                  )
              );
    });

/* The main function  */
const run = async () => {
    const state = await getState();
    const config = provideDefaults(state);
    const errors = validateInput(config);
    const nodes = transformData(clusterTree, labels);

    if (errors) {
        console.log('error!');
        console.error(errors);
        process.exit(1);
    }

    return saveTree(config, nodes);
};

/* Run the script */
run()
    .then(() => {
        console.log('script ran successfully');
        process.exit(0);
    })
    .catch(e => {
        console.log('error!');
        console.log(e);
        process.exit(1);
    });
