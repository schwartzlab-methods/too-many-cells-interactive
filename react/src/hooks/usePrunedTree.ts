import { useEffect, useRef, useState } from 'react';
import { compose } from 'redux';
import { HierarchyNode } from 'd3-hierarchy';
import { max, median, min, range, ticks } from 'd3-array';
import { TMCNode } from '../types';
import {
    Distributions,
    selectActivePruneStep,
    selectPruneHistory,
    updateDistributions,
} from '../redux/pruneSlice';
import {
    selectWidth,
    TreeMetaData,
    updateTreeMetadata,
} from '../redux/displayConfigSlice';
import {
    calculateTreeLayout,
    getMAD,
    pruneStepIsEmpty,
    pruneTreeByMinDistance,
    pruneTreeByMinDistanceSearch,
    pruneTreeByMinValue,
    rerunPrunes,
    runClickPrunes,
    runPrune,
} from '../util';
import useAppSelector from './useAppSelector';
import useAppDispatch from './useAppDispatch';

/* 
    todo: "base tree" needs to be updated sometimes (i.e., with expression values) 
    we could use composition, or we could handle it all here
        -- i.e., listen for expression changes, then update the counts and rerun the prunes
        -- actually that sounds good
    for composition:
        -- we could expose a setBaseTree prop (for the useStateHook for baseTree)
        -- then when some consumer calls it (i.e., after updating expression values)
            our useExpression hook, we'll have a useEffect that reruns all the pruners from scratch
            with the new nodes

    we can cache the trees at various steps, but let's just see how slow it is to rerun always
*/
const usePrunedTree = (tree: HierarchyNode<TMCNode>) => {
    const [visibleNodes, setVisibleNodes] = useState(tree);

    const dispatch = useAppDispatch();

    const { step, index: activePruneIndex } = useAppSelector(
        selectActivePruneStep
    );

    const pruneHistory = useAppSelector(selectPruneHistory);

    const width = useAppSelector(selectWidth);

    const { clickPruneHistory } = step;

    const currentStep = useRef(-1);

    useEffect(() => {
        if (pruneStepIsEmpty(step)) {
            //if this is a new prune or a full revert, i.e., if step is empty recalculate base ditributions from visibleNodes
            compose(
                dispatch,
                updateDistributions,
                buildPruneMetadata
            )(activePruneIndex === 0 ? tree.copy() : visibleNodes);

            if (activePruneIndex === 0) {
                setVisibleNodes(calculateTreeLayout(tree.copy(), width));
            }
        }
    }, [step]);

    /* for now rerun everytime and keep an eye on performance */
    useEffect(() => {
        if (!pruneStepIsEmpty(step)) {
            const prunedNodes = rerunPrunes(
                activePruneIndex,
                pruneHistory,
                tree.copy()
            );

            setVisibleNodes(calculateTreeLayout(prunedNodes, width));
        }
    }, [clickPruneHistory, activePruneIndex]);

    useEffect(() => {
        updateTreeMetadata(buildTreeMetadata(visibleNodes));
    }, [visibleNodes]);

    useEffect(() => {
        //we update this value last, after other hookds have used it
        currentStep.current = activePruneIndex;
    }, [activePruneIndex]);

    return visibleNodes;
};

export default usePrunedTree;

const buildPruneMetadata = (nodes: HierarchyNode<TMCNode>): Distributions => ({
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

const buildTreeMetadata = (nodes: HierarchyNode<TMCNode>): TreeMetaData => ({
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
const getDepthGroups = (tree: HierarchyNode<TMCNode>) => {
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
    tree: HierarchyNode<TMCNode>,
    cutoffDistance: number,
    pruneFn: (
        tree: HierarchyNode<TMCNode>,
        size: number
    ) => HierarchyNode<TMCNode>,
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
    tree: HierarchyNode<TMCNode>,
    cutoffDistance: number,
    pruneFn: (
        tree: HierarchyNode<TMCNode>,
        size: number
    ) => HierarchyNode<TMCNode>
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
const getMaxCutoffDistance = (tree: HierarchyNode<TMCNode>) => {
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
const getMaxCutoffDistanceSearch = (tree: HierarchyNode<TMCNode>) => {
    if (tree.children) {
        return min(tree.children.map(d => d.data.distance || 0))!;
    } else return 0;
};

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree
 * This ends up being the smallest child of the root
 */
const getMaxCutoffNodeSize = (tree: HierarchyNode<TMCNode>) => {
    if (tree.children) {
        return min(tree.children.map(d => d.value || 0));
    } else return 0;
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` <= n in tree
 */
const getSizeGroups = (tree: HierarchyNode<TMCNode>, binCount = 50) => {
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
const getSizeMadGroups = (tree: HierarchyNode<TMCNode>) => {
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
