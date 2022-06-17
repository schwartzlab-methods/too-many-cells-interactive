import { useEffect, useState } from 'react';
import { max, median, min, sum } from 'd3-array';
import { HierarchyPointNode } from 'd3-hierarchy';
import { bindActionCreators } from 'redux';
import {
    clearFeatureMaps as _clearFeatureMaps,
    FeatureDistribution,
    selectFeatureSlice,
    updateFeatureDistributions as _updateFeatureDistributions,
} from '../redux/featureSlice';
import {
    selectScales,
    updateColorScaleThresholds as _updateColorScaleThresholds,
} from '../redux/displayConfigSlice';
import { AttributeMap, TMCNode } from '../types';
import { getEntries, getMAD } from '../util';
import useAppDispatch from './useAppDispatch';
import useAppSelector from './useAppSelector';
import { usePrunedTree } from './index';

/* should be called top-level, so initialTree stays kosher */
const useTree = (initialTree: HierarchyPointNode<TMCNode>) => {
    const [baseTree, setBaseTree] = useState(initialTree);

    const { activeFeatures, featureMaps } = useAppSelector(selectFeatureSlice);

    const {
        clearFeatureMaps,
        updateColorScaleThresholds,
        updateFeatureDistributions,
    } = bindActionCreators(
        {
            clearFeatureMaps: _clearFeatureMaps,
            updateColorScaleThresholds: _updateColorScaleThresholds,
            updateFeatureDistributions: _updateFeatureDistributions,
        },
        useAppDispatch()
    );

    const {
        colorScale: { featureThresholds },
    } = useAppSelector(selectScales);

    useEffect(() => {
        if (Object.values(featureMaps).length) {
            const { tree, distributions } = addFeaturesToItems(
                baseTree,
                featureMaps
            );
            setBaseTree(tree);
            getEntries(distributions).map(([k, v]) => {
                updateColorScaleThresholds({ [k]: v.median });
                updateFeatureDistributions({ [k]: v });
            });

            clearFeatureMaps();
        }
    }, [featureMaps]);

    useEffect(() => {
        if (Object.values(featureThresholds).length) {
            setBaseTree(
                updateFeatureCounts(baseTree, featureThresholds, activeFeatures)
            );
        }
    }, [activeFeatures, featureThresholds]);

    return usePrunedTree(baseTree);
};

const updateFeatureCounts = (
    nodes: HierarchyPointNode<TMCNode>,
    thresholds: Record<string, number>,
    activeFeatures: string[]
) => {
    nodes.eachAfter(n => {
        // for the scale to read
        const hilo = {} as AttributeMap;

        //todo: this should be filtered by ACTIVE, and we should also put distribution here? Not sure?

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
            n.children!.map(node => node.data.featureCount).forEach(count => {
                for (const featurekey in count) {
                    if (!hilo[featurekey]) {
                        hilo[featurekey] = count[featurekey];
                    } else {
                        hilo[featurekey].quantity += count[featurekey].quantity;
                    }
                }
            });
        }
        n.data.featureCount = hilo;
        return n;
    });

    return nodes;
};

//we want to annotate leaves and also update featureCounts
const addFeaturesToItems = (
    tree: HierarchyPointNode<TMCNode>,
    featureMaps: Record<string, Record<string, number>>
) => {
    const distributions = {} as Record<string, FeatureDistribution>;
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

        const med = median(range.filter(Boolean));
        const medianWithZeroes = median(range);

        distributions[feature] = {
            mad: getMAD(range.filter(Boolean)) || 0, //remove 0s
            madWithZeroes: getMAD(range) || 0, //remove 0s
            max: max(range) || 0,
            min: min(range) || 0,
            median: med || 0,
            medianWithZeroes: medianWithZeroes || 0,
            total: sum(range) || 0,
        };
    });

    return { tree, distributions };
};

export default useTree;
