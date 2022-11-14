import { useEffect, useState } from 'react';
import { bindActionCreators, compose } from 'redux';
import { extent, max, median, min, range, sum, ticks } from 'd3-array';
import {
    AttributeMap,
    FeatureMap,
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
    getEntries,
    getMAD,
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
    including prunes, user annotations, and feature additions.    
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

            const thresholds = {} as Record<string, number>;

            // then calculate new scale thresholds, which will cause next hook to fire, which will
            // calculate node-level counts based on these new thresholds

            Object.keys(featureMaps).forEach(k => {
                const range = treeWithCells
                    .leaves()
                    .flatMap(n => getNodeFeatureCounts(n, k));

                const med = median(range.filter(Boolean))!;
                thresholds[k] = med;
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

    useEffect(() => {
        if (activeFeatures.length) {
            updateFeatureDistributions(
                getFeatureDistributions(tree, activeFeatures)
            );

            const featureAverages = getFeatureGradientDomain(visibleNodes);

            updateColorScale({ featureGradientDomain: featureAverages });
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
        const prunedTree = recalculateLayout();
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
            updateColorScale({
                featureGradientDomain: getFeatureGradientDomain(visibleNodes),
            });
            updateFeatureDistributions(
                getFeatureDistributions(visibleNodes, activeFeatures)
            );
        }
        //eslint-disable-next-line react-hooks/exhaustive-deps
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
    featureMaps: FeatureMap
) => {
    getEntries(featureMaps).map(([feature, featureMap]) => {
        const range: number[] = [];

        tree.leaves().forEach(n => {
            if (n.data.items) {
                n.data.items = n.data.items.map(cell => {
                    //add the new feature to cell-level raw feature counts
                    const fcounts = cell._barcode._featureValues || {};
                    fcounts[feature] = featureMap[cell._barcode.unCell] || 0;
                    cell._barcode._featureValues = fcounts;
                    range.push(fcounts[feature] as number);
                    return cell;
                });
            }
        });
    });

    return tree;
};

export const addUserAnnotations = (
    tree: TMCHierarchyDataNode,
    userAnnoationMap: AttributeMap
) =>
    tree.each(
        n =>
            (n.data.userAnnotation = {
                userAnnotation: userAnnoationMap[n.data.nodeId] ?? {
                    quantity: null,
                    scaleKey: null,
                },
            })
    );

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
        mad: getMAD(
            nodes
                .descendants()
                .map(v => v.data.distance!)
                .filter(Boolean)
        )!,
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
const getDepthGroups = (tree: TMCHierarchyDataNode): CumSumBin[] => {
    const maxSize = max(tree.descendants().map(n => n.depth))!;

    return range(0, maxSize + 1).map(value => ({
        value,
        count: tree.descendants().filter(d => d.depth <= value).length,
    }));
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` <= n in tree
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
 * @param tree the pruned tree (we calculate new distributions for each prune)
 * @param cutoffDistance the MAXIMUM distance that can be pruned before the tree collapses into one generation of nodes.
 *  This is the smallest value among the root's grandchildren.
 * @returns object keyed by integer `n` whose value is count of nodes with `distance` >= median + (n * MAD) in tree
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
 */
const getMinCutoffDistanceSearch = (tree: TMCHierarchyDataNode) => {
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
 * get the total features in a given cell
 *
 * @param node TMCHiearchyNode
 * @param feature feature name
 * @returns number
 */
const getNodeFeatureTotalCount = (node: TMCHiearchyNode, feature: string) => {
    let total = 0;
    for (const item of node.data.items || []) {
        total += item._barcode._featureValues![feature] || 0;
    }

    return total;
};

/**
 * get counts for features among cells in the given node
 *
 * @param node TMCHiearchyNode
 * @param feature feature name
 * @returns number
 */
const getNodeFeatureCounts = (node: TMCHiearchyNode, feature: string) =>
    (node.data.items || []).map(
        item => item._barcode._featureValues![feature] || 0
    );

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` <= n in tree
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
 * @returns object keyed by integer `n` whose value is count of nodes with `value` >= median + (n * MAD) in tree
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

const getMadGroups = (values: number[], binCount = 15, maxSize?: number) => {
    const mad = getMAD(values)!;
    const med = median(values)!;

    const [min, max] = extent(values.filter(v => v <= (maxSize ?? Infinity)));

    // assume that min is less than median...
    const greatestNegativeMadDistance =
        valueToMadCount(min || 0, med, mad) * -1;

    // assume that max is greater than median...
    const greatestPositiveMadDistance = valueToMadCount(max || 0, med, mad);

    const binSize =
        Math.abs(
            Math.abs(greatestPositiveMadDistance) -
                Math.abs(greatestNegativeMadDistance)
        ) / binCount;

    return range(
        greatestNegativeMadDistance,
        greatestPositiveMadDistance,
        binSize
    ).map(n => ({
        value: madCountToValue(n, med, mad),
        mads: n,
    }));
};

/* Note that these values are for cells, not nodes */
const getFeatureDistributions = (
    nodes: TMCHierarchyDataNode,
    activeFeatures: string[]
) => {
    const distributions = {} as Record<string, FeatureDistribution>;

    activeFeatures.forEach(f => {
        const dist = nodes.leaves().flatMap(d => getNodeFeatureCounts(d, f));

        const distWithoutZeroes = dist.filter(Boolean);

        //median feature count among cells
        const med = median(distWithoutZeroes);

        const medianWithZeroes = median(dist);

        //if we include zeroes the median will be zero
        const mad = getMAD(distWithoutZeroes)!;

        distributions[f] = {
            mad,
            madGroups: getMadGroups(distWithoutZeroes).map(b => {
                const res = {
                    value: b.mads,
                    count: nodes
                        .leaves()
                        //we want the count of nodes that have at least one cell under the mad threshold filter
                        .filter(
                            d =>
                                !!(d.data.items || []).filter(
                                    i =>
                                        (i._barcode._featureValues[f] || 0) >=
                                        b.value
                                ).length
                        ).length,
                };
                return res;
            }),
            madWithZeroes: getMAD(dist) ?? 0,
            max: max(dist) ?? 0,
            min: min(dist) ?? 0,
            median: med ?? 0,
            medianWithZeroes: medianWithZeroes ?? 0,
            plainGroups: getPlainFeatureGroups(dist),
            total: sum(dist) ?? 0,
        };
    });

    return distributions;
};

/**
 * Divide the feature counts into bins, each keyed by cumsum
 * @param range: the feature counts
 */
const getPlainFeatureGroups = (range: number[]): CumSumBin[] => {
    const thresholds = ticks(0, max(range) || 0, Math.max(max(range) || 0, 25));

    const tx = thresholds.map(value => ({
        value,
        count: range.filter(n => n > value).length,
    }));

    return tx;
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
 *
 * @param nodes The base tree (not a pruned tree)
 * @param thresholds The cutoff for hi/lo for each feature
 * @param activeFeatures The features currently visible
 * @returns TMCHierarchyDataNode (argument will be mutated)
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
                const key = getEntries(cell._barcode._featureValues)
                    //eslint-disable-next-line @typescript-eslint/no-unused-vars
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
