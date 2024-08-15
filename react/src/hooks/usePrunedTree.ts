import { useEffect, useState } from 'react';
import { bindActionCreators, compose } from 'redux';
import { extent, max, median, min, range, sum, ticks } from 'd3-array';
import {
    AttributeMap,
    FeatureMap,
    PlainOrMADVal,
    TMCHiearchyNode,
    TMCHierarchyDataNode,
} from '../types';
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
    clearUserAnnotationMaps as _clearUserAnnotationMaps,
    FeatureDistribution,
    selectAnnotationSlice,
    updateFeatureDistributions as _updateFeatureDistributions,
} from '../redux/annotationSlice';
import {
    calculateTreeLayout,
    getDistances,
    getEntries,
    getMAD,
    getSizes,
    madCountToValue,
    pruneTreeByMinDistance,
    pruneTreeByMinDistanceSearch,
    pruneTreeByMinValue,
    runPrunes,
    valueToMadCount,
} from '../util';
import { CumSumBin } from '../Visualizations/AreaChart';
import useAppSelector from './useAppSelector';
import useAppDispatch from './useAppDispatch';
import { getFeatureAverage } from './useScale';

/* This hook has become the site of most tree transformations -- it reacts to changes in state that require the tree to be altered in some way,
    including prunes, user annotations, and feature additions. It depends on effects firing in the order they are defined here, and changing the
    order can lead to unexpected behavior, as can altering the dependency arrays, which deliberately ignore changes in certain objects for purposes
    of efficiency.

    TODO: refactor into discrete hooks.
*/

const usePrunedTree = (tree: TMCHierarchyDataNode) => {
    const [baseTree, setBaseTree] = useState(tree);

    /* action creators */

    const {
        clearFeatureMaps,
        clearUserAnnotationMaps,
        updateColorScale,
        updateColorScaleThresholds,
        updateDistributions,
        updateFeatureDistributions,
        updateTreeMetadata,
    } = bindActionCreators(
        {
            clearFeatureMaps: _clearFeatureMaps,
            clearUserAnnotationMaps: _clearUserAnnotationMaps,
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
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseTree]);

    const { activeFeatures, featureMaps, userAnnoationMap } = useAppSelector(
        selectAnnotationSlice
    );

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

            const thresholds = {} as Record<string, PlainOrMADVal>;

            // then calculate new scale thresholds, which will cause next hook to fire, which will
            // calculate node-level counts based on these new thresholds

            Object.keys(featureMaps).forEach(k => {
                const range = treeWithCells
                    .leaves()
                    .flatMap(n => getNodeFeatureCounts(n, k));

                const med = median(range.filter(Boolean))!;
                thresholds[k] = { plainValue: med };
            });

            updateColorScaleThresholds(thresholds);
            setBaseTree(treeWithCells);
            clearFeatureMaps();
        }
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [featureMaps]);

    //USER ANNOTATION EFFECTS

    useEffect(() => {
        if (Object.values(userAnnoationMap).length) {
            //annotate nodes with user values
            const treeWithUserAnnotations = addUserAnnotations(
                baseTree.copy(),
                userAnnoationMap
            );

            updateColorScale({
                userAnnotationDomain: extent(
                    Object.values(userAnnoationMap).map(v => v.quantity)
                ) as [number, number],
            });

            setBaseTree(treeWithUserAnnotations);
            clearUserAnnotationMaps();
        }
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userAnnoationMap]);

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
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFeatures, featureHiLoThresholds]);

    /* If there are new features, we also need to update the scales */
    useEffect(() => {
        if (activeFeatures.length) {
            updateFeatureDistributions(
                getFeatureDistributions(tree, activeFeatures)
            );

            const featureAverages = getFeatureGradientDomain(visibleNodes);

            const featureDomains = getFeatureDomains(
                visibleNodes,
                activeFeatures
            );
            updateColorScale({
                featureGradientDomain: getFeatureGradientDomain(visibleNodes),
                featuresGradientDomains: featureDomains,
            });

            updateColorScale({
                featureGradientDomain: featureAverages,
                featuresGradientDomains: featureDomains,
            });
        }
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFeatures]);

    /* PRUNING EFFECTS */
    useEffect(() => {
        // if this is a new step, recalculate base ditributions from visibleNodes
        const _tree = activePruneIndex === 0 ? tree.copy() : visibleNodes;

        compose(updateDistributions, buildPruneMetadata)(_tree);

        updateFeatureDistributions(
            getFeatureDistributions(_tree, activeFeatures)
        );
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePruneIndex]);

    /* for now, when a prune runs, we rerun all prunes -- if performance suffers we can optimize */
    useEffect(() => {
        /* recalc layout and update pruned ids */
        const prunedTree = recalculateLayout().eachBefore((n, i) => {
            n.data.prunedNodeId = i;
        });

        const withNewFeatureCounts = updateFeatureCounts(
            prunedTree,
            activeFeatures
        );

        setVisibleNodes(calculateTreeLayout(withNewFeatureCounts, width));
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clickPruneHistory, activePruneIndex]);

    /* update base tree meta and feature scale (if features loaded) on all prunes */
    useEffect(() => {
        updateTreeMetadata(buildTreeMetadata(visibleNodes));
        if (activeFeatures.length) {
            updateFeatureDistributions(
                getFeatureDistributions(visibleNodes, activeFeatures)
            );
            const featureDomains = getFeatureDomains(
                visibleNodes,
                activeFeatures
            );
            updateColorScale({
                featureGradientDomain: getFeatureGradientDomain(visibleNodes),
                featuresGradientDomains: featureDomains,
            });
        }
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleNodes]);

    const recalculateLayout = () =>
        runPrunes(activePruneIndex, pruneHistory, tree.copy());

    return visibleNodes;
};

export default usePrunedTree;

/**
 * Get the max and min feature average for the tree
 * @param {TMCHierarchyDataNode} tree
 * @returns {Array<number, number>}
 */
export const getFeatureGradientDomain = (tree: TMCHierarchyDataNode) =>
    extent(
        tree
            .descendants()
            .map(d => d.data.featureAverage?.average?.quantity || 0)
    ) as [number, number];

/**
 * Annotate leaf nodes with feature counts
 * @param {TMCHierarchyDataNode} tree
 * @param {FeatureMap} featureMaps
 * @returns {TMCHierarchyDataNode} the mutated tree
 */
export const addFeaturesToCells = (
    tree: TMCHierarchyDataNode,
    featureMaps: FeatureMap
) => {
    getEntries(featureMaps).map(([feature, featureMap]) => {
        tree.leaves().forEach(n => {
            if (n.data.items) {
                n.data.items = n.data.items.map(cell => {
                    //add the new feature to cell-level raw feature counts
                    const fcounts = cell._barcode._featureValues || {};
                    fcounts[feature] = featureMap[cell._barcode.unCell] || 0;
                    cell._barcode._featureValues = fcounts;
                    return cell;
                });
            }
        });
    });

    return tree;
};

/**
 * Annotate nodes with user annotations
 * @param {TMCHierarchyDataNode} tree
 * @param {FeatureMap} userAnnoationMap
 * @returns {TMCHierarchyDataNode} the mutated tree
 */
export const addUserAnnotations = (
    tree: TMCHierarchyDataNode,
    userAnnoationMap: AttributeMap
) =>
    tree.each(
        n =>
            (n.data.userAnnotation = {
                userAnnotation: userAnnoationMap[n.data.originalNodeId] ?? {
                    quantity: null,
                    scaleKey: null,
                },
            })
    );

/**
 * Calculate metadata and distribution information for pruners
 * @param {TMCHierarchyDataNode} nodes the tree
 * @returns {Distributions}
 */
const buildPruneMetadata = (nodes: TMCHierarchyDataNode): Distributions => ({
    depthGroups: getDepthGroups(nodes),
    distance: {
        mad: compose(getMAD, getDistances)(nodes),
        madGroups: getDistanceMadGroups(
            nodes,
            getMinCutoffDistance(nodes),
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
            getMinCutoffDistance(nodes),
            pruneTreeByMinDistance
        ),
    },
    distanceSearch: {
        mad: compose(getMAD, getDistances)(nodes),
        madGroups: getDistanceMadGroups(
            nodes,
            getMinCutoffDistanceSearch(nodes),
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
            getMinCutoffDistanceSearch(nodes),
            pruneTreeByMinDistanceSearch
        ),
    },
    size: {
        mad: compose(getMAD, getSizes)(nodes),
        madGroups: getSizeMadGroups(nodes),
        median: median(nodes.descendants().map(v => v.value!))!,
        plainGroups: getSizeGroups(nodes),
    },
});

/**
 * Calculate metadata for the tree
 * @param {TMCHierarchyDataNode} nodes tree
 * @returns {TreeMetaData}
 */
const buildTreeMetadata = (nodes: TMCHierarchyDataNode): TreeMetaData => ({
    leafCount: nodes.leaves().length,
    maxDistance: max(nodes.descendants().map(n => n.data.distance!)) || 0,
    minDistance: min(nodes.descendants().map(n => n.data.distance!)) || 0,
    minValue: min(nodes.descendants().map(n => n.value!)) || 0,
    maxValue: max(nodes.descendants().map(n => n.value!)) || 0,
    nodeCount: nodes.descendants().length,
});

/**
 * Bin the nodes by depth
 * @param {TMCHierarchyDataNode} tree
 * @returns {CumSumBin[]} array of objects whose `value` is integer `n` and `count` is number of nodes with `depth` <= `n`
 */
const getDepthGroups = (tree: TMCHierarchyDataNode): CumSumBin[] => {
    const maxSize = max(tree.descendants().map(n => n.depth))!;

    return range(0, maxSize + 1).map(value => ({
        value,
        count: tree.descendants().filter(d => d.depth <= value).length,
    }));
};

/**
 * Bin the nodes by distance
 * @param {TMCHierarchyDataNode} tree
 * @param {number} cutoffDistance
 * @param {Fn} pruneFn
 * @param {number} binCount
 * @returns {CumSumBin[]} array of objects whose `value` is integer `n` whose `count` is number of nodes with `value` <= `n` in tree
 */
const getDistanceGroups = (
    tree: TMCHierarchyDataNode,
    cutoffDistance: number,
    pruneFn: (tree: TMCHierarchyDataNode, size: number) => TMCHierarchyDataNode,
    binCount = 50
): CumSumBin[] => {
    const bounds = ticks(
        min(
            tree
                .descendants()
                .filter(v => (v.data.distance || 0) <= cutoffDistance)
                .map(d => d.data.distance || 0)
        )!,
        cutoffDistance,
        binCount
    );

    return bounds.map(value => ({
        value,
        count: pruneFn(tree, value).descendants().length,
    }));
};

/**
 * Bin the nodes by MAD distance
 * @param {TMCHierarchyDataNode} tree the pruned tree (we calculate new distributions for each prune)
 * @param {number} cutoffDistance the MAXIMUM distance that can be pruned before the tree collapses into one generation of nodes.
 *  This is the smallest value among the root's grandchildren.
 * @param {Fn} pruneFn
 * @returns {CumSumBin} array of objects whose value is integer `n` and whose `count` is number of nodes with `distance` >= median + (n * MAD) in tree
 */
const getDistanceMadGroups = (
    tree: TMCHierarchyDataNode,
    cutoffDistance: number,
    pruneFn: (tree: TMCHierarchyDataNode, size: number) => TMCHierarchyDataNode
): CumSumBin[] => {
    const values = tree
        .descendants()
        .filter(d => d.data.distance !== null)
        .map(d => d.data.distance || 0) //redundant but needed for TS
        .sort((a, b) => (a! < b! ? -1 : 1));

    const groups = getMadGroups(values, 25, cutoffDistance);

    return groups.map(b => ({
        value: b.mads,
        count: pruneFn(tree, b.value).descendants().length,
    }));
};

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree.
 * This ends up being the smallest value of the first two generations
 *  and represents the MAXIMUM value we can prune and still have a tree
 * @param {TMCHiearchyDataNode} tree
 * @returns {number}
 */
const getMinCutoffDistance = (tree: TMCHierarchyDataNode) => {
    if (tree.children) {
        return min(
            tree
                .descendants()
                .filter(n => n.depth <= 1)
                .map(n => n.data.distance || 0)
        )!;
    } else return 0;
};

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree
 * This ends up being the smallest child of the root
 * @param {TMCHiearchyDataNode} tree
 * @returns {number}
 */
const getMinCutoffDistanceSearch = (tree: TMCHierarchyDataNode) => {
    if (tree.children) {
        return min(tree.children.map(d => d.data.distance || 0))!;
    } else return 0;
};

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree
 * This ends up being the smallest child of the root
 * @param {TMCHiearchyDataNode} tree
 * @returns {number}
 */
const getMaxCutoffNodeSize = (tree: TMCHierarchyDataNode) => {
    if (tree.children) {
        return min(tree.children.map(d => d.value || 0));
    } else return 0;
};

/**
 * Get the total features in a given cell cluster (leaf node)
 * @param {TMCHiearchyDataNode} node TMCHiearchyNode
 * @param {string} feature feature name
 * @returns {number}
 */
const getNodeFeatureTotalCount = (node: TMCHiearchyNode, feature: string) => {
    let total = 0;
    for (const item of node.data.items || []) {
        total += item._barcode._featureValues![feature] || 0;
    }

    return total;
};

/**
 * Get counts for features among cells in the given (leaf) node
 * @param {TMCHiearchyNode} node TMCHiearchyNode
 * @param {string} feature feature name
 * @returns number
 */
const getNodeFeatureCounts = (node: TMCHiearchyNode, feature: string) =>
    (node.data.items || []).map(
        item => item._barcode._featureValues![feature] || 0
    );

/**
 * Bin the nodes by size
 * @param {TMCHierarchyDataNode} tree the pruned tree (we calculate new distributions for each prune)
 * @param {number} binCount
 * @returns {Array<CumSumBin>} array of objects whose `value` is integer `n` and whose `count` is number of nodes with `size` >= `value`
 */
const getSizeGroups = (
    tree: TMCHierarchyDataNode,
    binCount = 50
): CumSumBin[] => {
    const maxSize = getMaxCutoffNodeSize(tree)!;

    const bounds = ticks(0, maxSize, binCount);

    return bounds.map(value => ({
        value,
        count: pruneTreeByMinValue(tree, value).descendants().length,
    }));
};

/**
 * Bin the nodes by size as MAD
 * @param {TMCHiearchyDataNode} tree
 * @returns {Array<CumSumBin>} array of objects whose `value` is integer `n` and whose `count` is number of with `value` >= median + (n * MAD) in tree
 */
const getSizeMadGroups = (tree: TMCHierarchyDataNode): CumSumBin[] => {
    const maxSize = getMaxCutoffNodeSize(tree)!;

    const values = tree
        .descendants()
        .map(d => d.value!)
        .sort((a, b) => (a < b ? -1 : 1));

    const groups = getMadGroups(values, 15, maxSize);

    return groups.map(b => ({
        value: b.mads,
        count: pruneTreeByMinValue(tree, b.value).descendants().length,
    }));
};

/**
 * Bin values by MAD value
 * @param {Array<number>} values
 * @param {number} binCount
 * @param {number} maxSize
 * @returns {Array<object>}
 */
const getMadGroups = (values: number[], binCount = 15, maxSize?: number) => {
    const mad = getMAD(values)!;
    const med = median(values)!;

    const [min, max] = extent(values.filter(v => v <= (maxSize ?? Infinity)));

    // assume that min is less than median...
    const greatestNegativeMadDistance =
        valueToMadCount(min || 0, med, mad) * -1;

    // assume that max is greater than median...
    const greatestPositiveMadDistance = valueToMadCount(max || 0, med, mad);

    // greatestPositiveMadDistance is >= 0 by def.
    // greatestNegativeMadDistance is <= 0 by def.
    // Therefore binSize is guaranteed to be >= 0.
    const binSize = (greatestPositiveMadDistance -
                greatestNegativeMadDistance) / binCount;

    return range(
        greatestNegativeMadDistance,
        greatestPositiveMadDistance,
        binSize
    ).map(n => ({
        value: madCountToValue(n, med, mad),
        mads: n,
    }));
};

/**
 * Get the median and MAD(s) for a feature distribution in the tree
 * @param {TMCHierarchyDataNode} node The tree
 * @param {string} feature The feature
 * @returns {object}
 */
export const getFeatureMadAndMeds = (
    node: TMCHierarchyDataNode,
    feature: string
) => {
    const dist = node
        .descendants()
        .map(d => d.data.featureCount[feature].scaleKey as number);

    const distWithoutZeroes = dist.filter(Boolean);

    //median feature count among cells
    const med = median(distWithoutZeroes);

    const medWithZeroes = median(dist);

    //if we include zeroes the median will be zero
    const mad = getMAD(distWithoutZeroes)!;

    return { med, mad, medWithZeroes };
};

/**
 *
 * @param {TMCHiearchyDataNode} nodes The tree, possibly pruned
 * @param {Array<string>} activeFeatures
 * @returns {Record<string, FeatureDistribution>} Distribution of average feature-per-cell counts for each node according to current threshold
 */

const getFeatureDistributions = (
    nodes: TMCHierarchyDataNode,
    activeFeatures: string[]
) => {
    const distributions = {} as Record<string, FeatureDistribution>;

    activeFeatures.forEach(f => {
        const { med, mad, medWithZeroes } = getFeatureMadAndMeds(nodes, f);

        const dist = nodes
            .descendants()
            .map(d => d.data.featureCount[f].scaleKey as number);

        distributions[f] = {
            mad,
            madGroups: getMadGroups(dist.filter(Boolean)).map(b => ({
                value: b.mads,
                count: nodes
                    .descendants()
                    //we want the count of nodes that have an average above the threshold filter
                    .filter(
                        d =>
                            (d.data.featureCount[f].scaleKey as number) >
                            b.value
                    ).length,
            })),
            madWithZeroes: getMAD(dist) ?? 0,
            max: max(dist) ?? 0,
            min: min(dist) ?? 0,
            median: med ?? 0,
            medianWithZeroes: medWithZeroes ?? 0,
            plainGroups: getPlainFeatureGroups(dist),
            total: sum(dist) ?? 0,
        };
    });

    return distributions;
};

/**
 * Divide the feature counts into bins, each keyed by cumsum
 * @param {Array<number>} range: the feature counts
 * @returns {Array<CumSumBin>}
 */
const getPlainFeatureGroups = (range: number[]): CumSumBin[] => {
    const thresholds = ticks(
        min(range) || 0,
        max(range) || 0,
        Math.max(max(range) || 0, 25)
    );

    const tx = thresholds.map(value => ({
        value,
        count: range.filter(n => n > value).length,
    }));

    return tx;
};

/**
 * Annotate the each node in the tree with raw feature count (per feature),
 * average feature count per cell (per feature), and average count of all features
 * @param {TMCHierarchyDataNode} nodes the base tree (not a pruned tree)
 * @param {Array<string>} features the active features
 * @returns {TMCHierarchyDataNode} (mutated argument)
 */
export const updateFeatureCounts = (
    nodes: TMCHierarchyDataNode,
    features: string[]
) =>
    nodes.eachAfter(n => {
        if (n.data.items) {
            features.forEach(f => {
                const quantity = getNodeFeatureTotalCount(n, f);

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
 * Annotate nodes with feature high and low values
 * @param {TMCHierarchyDataNode} nodes The base tree (not a pruned tree, b/c we need leaves as only leaves have cells)
 * @param {Record<string, PlainOrMADVal>} thresholds The cutoff for hi/lo for each feature
 * @param {Array<string>} activeFeatures The features currently visible
 * @returns {TMCHierarchyDataNode} TMCHierarchyDataNode (mutated argument)
 */
export const updatefeatureHiLos = (
    nodes: TMCHierarchyDataNode,
    thresholds: Record<string, PlainOrMADVal>,
    activeFeatures: string[]
) =>
    nodes.eachAfter(n => {
        // for the scale to read
        const hilo = {} as AttributeMap;
        //if these are leaves, store and calculate base values
        if (n.data.items) {
            n.data.items.forEach(cell => {
                //reduce cells for each node to hi/los
                const key = getEntries(cell._barcode._featureValues)
                    //eslint-disable-next-line @typescript-eslint/no-unused-vars
                    .filter(([k, _]) => activeFeatures.includes(k))
                    //alphabetize keys for standardization
                    .sort(([k1], [k2]) => (k1 < k2 ? -1 : 1))
                    .reduce(
                        (acc, [k, v]) =>
                            `${acc ? acc + '-' : ''}${
                                v && v >= thresholds[k]?.plainValue
                                    ? 'high'
                                    : 'low'
                            }-${k}`,
                        ''
                    );
                //add to node's running total of hilos
                if (key) {
                    hilo[key] = !hilo[key]
                        ? { scaleKey: key, quantity: 1 }
                        : { ...hilo[key], quantity: hilo[key].quantity + 1 };
                }
            });
        } else {
            //if node is not a leaf, just add both children
            n.children!.map(node => node.data.featureHiLos).forEach(count => {
                for (const featurekey in count) {
                    if (!hilo[featurekey]) {
                        hilo[featurekey] = { ...count[featurekey] };
                    } else {
                        hilo[featurekey].quantity += count[featurekey].quantity;
                    }
                }
            });
        }
        n.data.featureHiLos = hilo;
    });

/**
 * Get the domain of each feature
 * @param {TMCHiearchyNode} tree
 * @param {Array<string>} activeFeatures
 * @returns {Record<string, number[]>}
 */
const getFeatureDomains = (tree: TMCHiearchyNode, activeFeatures: string[]) => {
    const domains = {} as Record<string, number[]>;

    activeFeatures.forEach(feature => {
        domains[feature] = [];
        tree.each(n =>
            domains[feature].push(
                n.data.featureCount[feature].scaleKey as number
            )
        );
    });
    return domains;
};
