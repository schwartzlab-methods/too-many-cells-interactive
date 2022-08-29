import { useEffect, useState } from 'react';
import { bindActionCreators, compose } from 'redux';
import { extent, max, median, min, range, sum, ticks } from 'd3-array';
import { AttributeMap, TMCHiearchyNode, TMCHierarchyDataNode } from '../types';
import {
    Distributions,
    selectActivePruneStep,
    selectPruneSlice,
    updateDistributions as _updateDistributions,
} from '../redux/pruneSlice';
import {
    selectDisplayConfig,
    TreeMetaData,
    updateColorScale as _updateColorScale,
    updateColorScaleThresholds as _updateColorScaleThresholds,
    updateTreeMetadata as _updateTreeMetadata,
} from '../redux/displayConfigSlice';
import {
    clearFeatureMaps as _clearFeatureMaps,
    FeatureDistribution,
    selectFeatureSlice,
    updateFeatureDistributions as _updateFeatureDistributions,
} from '../redux/featureSlice';
import {
    calculateTreeLayout,
    getEntries,
    getMAD,
    pruneTreeByMinDistance,
    pruneTreeByMinDistanceSearch,
    pruneTreeByMinValue,
    runPrunes,
} from '../util';
import useAppSelector from './useAppSelector';
import useAppDispatch from './useAppDispatch';
import { getFeatureAverage } from './useScale';

const usePrunedTree = (tree: TMCHierarchyDataNode) => {
    const [baseTree, setBaseTree] = useState(tree);

    /* action creators */

    const {
        clearFeatureMaps,
        updateColorScale,
        updateColorScaleThresholds,
        updateDistributions,
        updateFeatureDistributions,
        updateTreeMetadata,
    } = bindActionCreators(
        {
            clearFeatureMaps: _clearFeatureMaps,
            updateColorScale: _updateColorScale,
            updateColorScaleThresholds: _updateColorScaleThresholds,
            updateDistributions: _updateDistributions,
            updateFeatureDistributions: _updateFeatureDistributions,
            updateTreeMetadata: _updateTreeMetadata,
        },
        useAppDispatch()
    );

    const {
        scales: {
            colorScale: { featureHiLoThresholds },
        },
        width,
    } = useAppSelector(selectDisplayConfig);

    const [visibleNodes, setVisibleNodes] = useState(
        calculateTreeLayout(tree, width)
    );

    /* recalc layout if base changes (i.e., if nodes are re-annotated) */
    useEffect(() => {
        const newTree = recalculateLayout();
        setVisibleNodes(calculateTreeLayout(newTree, width));
    }, [baseTree]);

    const { activeFeatures, featureMaps } = useAppSelector(selectFeatureSlice);

    const { step, index: activePruneIndex } = useAppSelector(
        selectActivePruneStep
    );
    const { clickPruneHistory } = step;

    const { pruneHistory } = useAppSelector(selectPruneSlice);

    /* FEATURE ANNOTATION EFFECTS: */

    useEffect(() => {
        if (Object.values(featureMaps).length) {
            //first annotate cells with new feature counts
            const treeWithCells = addFeaturesToCells(
                baseTree.copy(),
                featureMaps
            ) as TMCHiearchyNode;

            const thresholds = {} as Record<string, number>;

            // then calculate new scale thresholds, which will cause next hook to fire, which will
            // calculate node-level counts based on these new thresholds

            Object.keys(featureMaps).forEach(k => {
                const range = treeWithCells
                    .leaves()
                    .flatMap(l =>
                        (l.data.items || []).map(
                            item => item._barcode._featureCounts![k] || 0
                        )
                    );

                const med = median(range.filter(Boolean))!;
                thresholds[k] = med;
            });

            updateColorScaleThresholds(thresholds);
            setBaseTree(treeWithCells);
            clearFeatureMaps();
        }
    }, [featureMaps]);

    /* when thresholds change or a new feature is added, we need to re-annotate nodes */
    useEffect(() => {
        if (
            activeFeatures.length ||
            Object.keys(featureHiLoThresholds).length
        ) {
            const annotatedTree = updatefeatureHiLos(
                tree.copy(),
                featureHiLoThresholds,
                activeFeatures
            );

            updateFeatureCounts(annotatedTree, activeFeatures);

            setBaseTree(annotatedTree);
        }
    }, [activeFeatures, featureHiLoThresholds]);

    useEffect(() => {
        if (activeFeatures.length) {
            updateFeatureDistributions(
                getFeatureDistributions(tree, activeFeatures)
            );

            const featureAverages = getFeatureGradientDomain(visibleNodes);

            updateColorScale({ featureGradientDomain: featureAverages });
        }
    }, [activeFeatures]);

    /* PRUNING EFFECTS */
    useEffect(() => {
        // if this is a new step, recalculate base ditributions from visibleNodes
        const _tree = activePruneIndex === 0 ? tree.copy() : visibleNodes;

        compose(updateDistributions, buildPruneMetadata)(_tree);

        updateFeatureDistributions(
            getFeatureDistributions(_tree, activeFeatures)
        );
    }, [activePruneIndex]);

    /* for now, when a prune runs, we rerun all prunes -- if performance suffers we can optimize */
    useEffect(() => {
        const prunedTree = recalculateLayout();
        const withNewFeatureCounts = updateFeatureCounts(
            prunedTree,
            activeFeatures
        );

        setVisibleNodes(calculateTreeLayout(withNewFeatureCounts, width));
    }, [clickPruneHistory, activePruneIndex]);

    /* update base tree meta and feature scale (if features loaded) on all prunes */
    useEffect(() => {
        updateTreeMetadata(buildTreeMetadata(visibleNodes));
        if (activeFeatures.length) {
            updateColorScale({
                featureGradientDomain: getFeatureGradientDomain(visibleNodes),
            });
            updateFeatureDistributions(
                getFeatureDistributions(visibleNodes, activeFeatures)
            );
        }
    }, [visibleNodes]);

    const recalculateLayout = () =>
        runPrunes(activePruneIndex, pruneHistory, tree.copy());

    return visibleNodes;
};

export default usePrunedTree;

export const getFeatureGradientDomain = (tree: TMCHierarchyDataNode) =>
    extent(
        tree
            .descendants()
            .map(d => d.data.featureAverage?.average?.quantity || 0)
    ) as [number, number];

export const addFeaturesToCells = (
    tree: TMCHierarchyDataNode,
    featureMaps: Record<string, Record<string, number>>
) => {
    getEntries(featureMaps).map(([feature, featureMap]) => {
        const range: number[] = [];

        tree.leaves().forEach(n => {
            if (n.data.items) {
                n.data.items = n.data.items.map(cell => {
                    //add the new feature to cell-level raw feature counts
                    const fcounts = cell._barcode._featureCounts || {};
                    fcounts[feature] = featureMap[cell._barcode.unCell] || 0;
                    cell._barcode._featureCounts = fcounts;
                    range.push(fcounts[feature] as number);
                    return cell;
                });
            }
        });
    });

    return tree;
};

const buildPruneMetadata = (nodes: TMCHierarchyDataNode): Distributions => ({
    depthGroups: getDepthGroups(nodes),
    distance: {
        mad: getMAD(
            nodes
                .descendants()
                .map(v => v.data.distance!)
                .filter(Boolean)
        )!,
        madGroups: getDistanceMadGroups(
            nodes,
            getMaxCutoffDistance(nodes),
            pruneTreeByMinDistance
        ),
        median: median(
            nodes
                .descendants()
                .map(v => v.data.distance!)
                .filter(Boolean)
        )!,
        plainGroups: getDistanceGroups(
            nodes,
            getMaxCutoffDistance(nodes),
            pruneTreeByMinDistance
        ),
    },
    distanceSearch: {
        mad: getMAD(
            nodes
                .descendants()
                .map(v => v.data.distance!)
                .filter(Boolean)
        )!,
        madGroups: getDistanceMadGroups(
            nodes,
            getMaxCutoffDistance(nodes),
            pruneTreeByMinDistanceSearch
        ),
        median: median(
            nodes
                .descendants()
                .map(v => v.data.distance!)
                .filter(Boolean)
        )!,
        plainGroups: getDistanceGroups(
            nodes,
            getMaxCutoffDistanceSearch(nodes),
            pruneTreeByMinDistanceSearch
        ),
    },
    size: {
        mad: getMAD(nodes.descendants().map(v => v.value!))!,
        madGroups: getSizeMadGroups(nodes),
        median: median(nodes.descendants().map(v => v.value!))!,
        plainGroups: getSizeGroups(nodes),
    },
});

const buildTreeMetadata = (nodes: TMCHierarchyDataNode): TreeMetaData => ({
    leafCount: nodes.leaves().length,
    maxDistance: max(nodes.descendants().map(n => n.data.distance!)) || 0,
    minDistance: min(nodes.descendants().map(n => n.data.distance!)) || 0,
    minValue: min(nodes.descendants().map(n => n.value!)) || 0,
    maxValue: max(nodes.descendants().map(n => n.value!)) || 0,
    nodeCount: nodes.descendants().length,
});

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `depth` <= n
 */
const getDepthGroups = (tree: TMCHierarchyDataNode) => {
    const maxSize = max(tree.descendants().map(n => n.depth))!;

    return range(0, maxSize + 1)
        .reverse()
        .reduce<Record<number, number>>(
            (acc, curr) => ({
                ...acc,
                [curr]: tree.descendants().filter(d => d.depth <= curr).length,
            }),
            {}
        );
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` <= n in tree
 */
const getDistanceGroups = (
    tree: TMCHierarchyDataNode,
    cutoffDistance: number,
    pruneFn: (tree: TMCHierarchyDataNode, size: number) => TMCHierarchyDataNode,
    binCount = 50
) => {
    const bounds = ticks(0, cutoffDistance, binCount);

    return bounds.reduce<Record<number, number>>(
        (acc, curr) => ({
            ...acc,
            [curr]: pruneFn(tree, curr).descendants().length,
        }),
        {}
    );
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `distance` >= median + (n * MAD) in tree
 */
const getDistanceMadGroups = (
    tree: TMCHierarchyDataNode,
    cutoffDistance: number,
    pruneFn: (tree: TMCHierarchyDataNode, size: number) => TMCHierarchyDataNode
) => {
    const values = tree
        .descendants()
        .map(d => d.data.distance!)
        .sort((a, b) => (a < b ? -1 : 1));

    const mad = getMAD(values)!;
    const med = median(values)!;

    const maxMads = Math.ceil((cutoffDistance - med) / mad);

    const bounds = range(0, maxMads).map(m => ({
        size: med + m * mad,
        mads: m,
    }));

    return bounds.reduce<Record<number, number>>(
        (acc, curr) => ({
            ...acc,
            [curr.mads]: pruneFn(tree, curr.size).descendants().length,
        }),
        {}
    );
};

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree
 * This ends up being the smallest grandchild of the root
 */
const getMaxCutoffDistance = (tree: TMCHierarchyDataNode) => {
    if (tree.children) {
        return min(
            tree.children.flatMap(d =>
                d.children ? d.children.map(d => d.data.distance || 0) : 0
            )
        )!;
    } else return 0;
};

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree
 * This ends up being the smallest child of the root
 */
const getMaxCutoffDistanceSearch = (tree: TMCHierarchyDataNode) => {
    if (tree.children) {
        return min(tree.children.map(d => d.data.distance || 0))!;
    } else return 0;
};

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree
 * This ends up being the smallest child of the root
 */
const getMaxCutoffNodeSize = (tree: TMCHierarchyDataNode) => {
    if (tree.children) {
        return min(tree.children.map(d => d.value || 0));
    } else return 0;
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` <= n in tree
 */
const getSizeGroups = (tree: TMCHierarchyDataNode, binCount = 50) => {
    const maxSize = getMaxCutoffNodeSize(tree)!;

    const bounds = ticks(0, maxSize, binCount);

    return bounds.reduce<Record<number, number>>(
        (acc, curr) => ({
            ...acc,
            [curr]: pruneTreeByMinValue(tree, curr).descendants().length,
        }),
        {}
    );
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` >= median + (n * MAD) in tree
 */
const getSizeMadGroups = (tree: TMCHierarchyDataNode) => {
    const maxSize = getMaxCutoffNodeSize(tree)!;

    const values = tree
        .descendants()
        .map(d => d.value!)
        .sort((a, b) => (a < b ? -1 : 1));

    const mad = getMAD(values)!;
    const med = median(values)!;

    const maxMads = Math.ceil((maxSize - med) / mad);

    const bounds = range(0, maxMads).map(m => ({
        size: med + m * mad,
        mads: m,
    }));

    return bounds.reduce<Record<number, number>>(
        (acc, curr) => ({
            ...acc,
            [curr.mads]: pruneTreeByMinValue(tree, curr.size).descendants()
                .length,
        }),
        {}
    );
};

const getFeatureDistributions = (
    nodes: TMCHierarchyDataNode,
    activeFeatures: string[]
) => {
    const distributions = {} as Record<string, FeatureDistribution>;

    activeFeatures.forEach(f => {
        const range = nodes
            .leaves()
            .flatMap(l =>
                (l.data.items || []).map(
                    item => item._barcode._featureCounts![f] || 0
                )
            );

        const med = median(range.filter(Boolean))!;

        const medianWithZeroes = median(range)!;

        const mad = getMAD(range.filter(Boolean)) || 0;

        distributions[f] = {
            mad,
            madGroups: getMadFeatureGroups(range.filter(Boolean), mad, med),
            madWithZeroes: getMAD(range) || 0, //remove 0s
            max: max(range) || 0,
            min: min(range) || 0,
            median: med || 0,
            medianWithZeroes: medianWithZeroes || 0,
            plainGroups: getPlainFeatureGroups(range.filter(Boolean)),
            total: sum(range) || 0,
        };
    });

    return distributions;
};

/**
 * Divide the feature counts into bins, each keyed by cumsum
 * @param range: the feature counts;
 */
const getPlainFeatureGroups = (range: number[]) => {
    const thresholds = ticks(0, max(range) || 0, Math.max(max(range) || 0, 25));

    const tx = thresholds.reduce<Record<number, number>>(
        (acc, curr) => ({
            ...acc,
            [curr]: range.filter(n => n > curr).length,
        }),
        {}
    );

    return tx;
};

/**
 * Divide the feature MAD count into bins, each keyed MAD count
 * @param range: the feature counts;
 */
const getMadFeatureGroups = (range: number[], mad: number, median: number) => {
    const maxVal = max(range) || 0;

    const maxMads = Math.ceil((maxVal - median) / mad);

    const thresholds = ticks(0, maxMads, Math.max(maxMads, 25));

    return thresholds.reduce<Record<number, number>>(
        (acc, curr) => ({
            ...acc,
            [curr]: range.filter(n => n > median + mad * curr).length,
        }),
        {}
    );
};

/**
 *
 * @param nodes the base tree (not a pruned tree)
 * @param features the active features
 * @returns TMCHierarchyDataNode (mutated argument)
 */
export const updateFeatureCounts = (
    nodes: TMCHierarchyDataNode,
    features: string[]
) =>
    nodes.eachAfter(n => {
        if (n.data.items) {
            features.forEach(f => {
                const quantity = n.data.items!.reduce(
                    (acc, curr) =>
                        (acc += curr._barcode._featureCounts[f] || 0),
                    0
                );

                const average = n.value ? quantity / n.value : 0;

                n.data.featureCount[f] = {
                    quantity,
                    scaleKey: average,
                };
            });
        } else {
            features.forEach(f => {
                const quantity = n.children
                    ? n.children![0].data.featureCount[f].quantity +
                      n.children![1].data.featureCount[f].quantity
                    : n.data.featureCount[f].quantity;

                n.data.featureCount[f] = {
                    quantity,
                    scaleKey: quantity / n.value!,
                };
            });
        }

        const quantity = getFeatureAverage(n, features);

        n.data.featureAverage = {
            average: {
                quantity,
                scaleKey: quantity,
            },
        };
    });

/**
 *
 * @ram nodes the base tree (not a pruned tree)
 * @param thresholds the cutoff for hi/lo for each feature
 * @param activeFeatures the features currently visible
 * @returns TMCHierarchyDataNode (mutated argument)
 */
export const updatefeatureHiLos = (
    nodes: TMCHierarchyDataNode,
    thresholds: Record<string, number>,
    activeFeatures: string[]
) =>
    nodes.eachAfter(n => {
        // for the scale to read
        const hilo = {} as AttributeMap;
        //if these are leaves, store and calculate base values
        if (n.data.items) {
            n.data.items.forEach(cell => {
                //reduce cells for each node to hi/lows
                const key = getEntries(cell._barcode._featureCounts)
                    .filter(([k, _]) => activeFeatures.includes(k))
                    //alphabetize keys for standardization
                    .sort(([k1], [k2]) => (k1 < k2 ? -1 : 1))
                    .reduce(
                        (acc, [k, v]) =>
                            `${acc ? acc + '-' : ''}${
                                v && v >= thresholds[k] ? 'high' : 'low'
                            }-${k}`,
                        ''
                    );
                //add to node's running total of hilos
                if (key) {
                    hilo[key] = hilo[key]
                        ? { ...hilo[key], quantity: hilo[key].quantity + 1 }
                        : { scaleKey: key, quantity: 1 };
                }
            });
        } else {
            //if node is not a leaf, just add both children
            n.children!.map(node => node.data.featureHiLos).forEach(count => {
                for (const featurekey in count) {
                    if (!hilo[featurekey]) {
                        hilo[featurekey] = count[featurekey];
                    } else {
                        hilo[featurekey].quantity += count[featurekey].quantity;
                    }
                }
            });
        }
        n.data.featureHiLos = hilo;
    });
