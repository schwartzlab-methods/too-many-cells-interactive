import { useEffect, useState } from 'react';
import { max, median, min, sum } from 'd3-array';
import { HierarchyPointNode } from 'd3-hierarchy';
import {
    clearFeatureMaps,
    selectFeatureSlice,
    updateFeatureDistributions,
} from '../redux/featureSlice';
import { selectWidth } from '../redux/displayConfigSlice';
import { selectActivePruneStep, selectPruneHistory } from '../redux/pruneSlice';
import { AttributeMap, TMCNode } from '../types';
import { calculateTreeLayout, getEntries, getMAD } from '../util';
import useAppDispatch from './useAppDispatch';
import useAppSelector from './useAppSelector';
import { usePrunedTree } from './index';

/* should be called top-level, so initialTree stays kosher */
const useTree = (initialTree: HierarchyPointNode<TMCNode>) => {
    const dispatch = useAppDispatch();

    const [baseTree, setBaseTree] = useState(initialTree);

    const { featureMaps, scaleThresholds } = useAppSelector(selectFeatureSlice);

    useEffect(() => {
        if (Object.values(featureMaps).length) {
            const { tree, distributions } = addFeaturesToItems(
                baseTree,
                featureMaps
            );
            setBaseTree(tree);
            getEntries(distributions).map(([k, v]) =>
                updateFeatureDistributions({ [k]: v })
            );
            dispatch(clearFeatureMaps);
        }
    }, [featureMaps]);

    useEffect(() => {
        setBaseTree(updateThresholds(baseTree, scaleThresholds));
    }, [scaleThresholds]);

    //question: do we need to rerun prunes? I don't think so... do we need a flag?
    //well, we could just have an initial prune...
    return usePrunedTree(baseTree);
};

const updateThresholds = (
    nodes: HierarchyPointNode<TMCNode>,
    thresholds: Record<string, number>
) => {
    nodes.eachAfter(n => {
        // our featureStats, for the scale to read
        const hilo = {} as AttributeMap;

        //if these are leaves, store and calculate base values
        if (n.data.items) {
            n.data.items.forEach(cell => {
                //reduce cells for each node to hi/lows
                const key = getEntries(cell._barcode._featureCounts).reduce(
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
    const distributions = {};
    getEntries(featureMaps).map(([feature, featureMap]) => {
        const range = [];

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
