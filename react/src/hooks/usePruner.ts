import { useEffect, useMemo, useRef, useState } from 'react';
import { compose } from 'redux';
import { HierarchyNode } from 'd3-hierarchy';
import { median, min, range, ticks } from 'd3-array';
import { TMCNode } from '../types';
import {
    AllPruner,
    ClickPruneType,
    ClickPruner,
    Distributions,
    selectActivePruneStep,
    selectPruneHistory,
    updateDistributions,
    ValuePruneType,
} from '../redux/pruneSlice';
import {
    calculateTreeLayout,
    collapseNode,
    getMAD,
    pruneStepIsEmpty,
    pruneTreeByDepth,
    pruneTreeByMinDistance,
    pruneTreeByMinDistanceSearch,
    pruneTreeByMinValue,
    setRootNode,
} from '../util';
import useAppSelector from './useAppSelector';
import useAppDispatch from './useAppDispatch';
import { selectWidth } from '../redux/displayConfigSlice';

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
*/
const usePruner = (tree: HierarchyNode<TMCNode>) => {
    const originalTree = useMemo(() => tree, []);
    const [visibleNodes, setVisibleNodes] = useState(tree);

    const dispatch = useAppDispatch();

    const { step, index: activePruneIndex } = useAppSelector(
        selectActivePruneStep
    );

    const pruneHistory = useAppSelector(selectPruneHistory);

    const width = useAppSelector(selectWidth);

    const { clickPruneHistory, valuePruner } = step;

    const currentStep = useRef(0);

    useEffect(() => {
        if (activePruneIndex && currentStep.current !== activePruneIndex) {
            //if this is a new prune or a full revert, i.e., if step is empty recalculate base ditributions from visibleNodes
            if (pruneStepIsEmpty(step)) {
                compose(
                    dispatch,
                    updateDistributions,
                    buildPruneMetadata
                )(visibleNodes);
            } //otherwise, this is a partial revert, so rebuild tree and refresh distributions
            else {
                let i = 0;
                let _prunedNodes =
                    originalTree!.copy() as HierarchyNode<TMCNode>;
                while (i <= activePruneIndex) {
                    _prunedNodes = runPrune(
                        pruneHistory[i].valuePruner,
                        _prunedNodes
                    );

                    _prunedNodes = runClickPrunes(
                        pruneHistory[i].clickPruneHistory,
                        _prunedNodes
                    );
                    i++;
                }

                setVisibleNodes(calculateTreeLayout(_prunedNodes, width));
            }
        }
    }, [activePruneIndex, step]);

    useEffect(() => {
        if (activePruneIndex === currentStep.current) {
            setVisibleNodes(runClickPrunes(clickPruneHistory, visibleNodes));
        }
    }, [clickPruneHistory, activePruneIndex]);

    useEffect(() => {
        if (activePruneIndex === currentStep.current) {
            setVisibleNodes(runPrune(valuePruner, visibleNodes));
        }
    }, [valuePruner, activePruneIndex]);

    useEffect(() => {
        //we update this value last, after other hookds have used it
        currentStep.current = activePruneIndex;
    }, [activePruneIndex]);

    return visibleNodes;
};

export default usePruner;

const buildPruneMetadata = (nodes: HierarchyNode<TMCNode>): Distributions => ({
    distance: {
        mad: getMAD(
            nodes
                .descendants()
                .map(v => v.data.distance!)
                .filter(Boolean)
        ),
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
        ),
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
        ),
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
        ),
        plainGroups: getDistanceGroups(
            nodes,
            getMaxCutoffDistanceSearch(nodes),
            pruneTreeByMinDistanceSearch
        ),
    },
    size: {
        mad: getMAD(nodes.descendants().map(v => v.value!)),
        madGroups: getSizeMadGroups(nodes),
        median: median(nodes.descendants().map(v => v.value!)),
        plainGroups: getSizeGroups(nodes),
    },
});

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

    return bounds.reduce(
        (acc, curr) => acc.set(curr, pruneFn(tree, curr).descendants().length),
        new Map<number, number>()
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

    return bounds.reduce(
        (acc, curr) =>
            acc.set(curr.mads, pruneFn(tree, curr.size).descendants().length),
        new Map<number, number>()
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

    return bounds.reduce(
        (acc, curr) =>
            acc.set(curr, pruneTreeByMinValue(tree, curr).descendants().length),
        new Map<number, number>()
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

    return bounds.reduce(
        (acc, curr) =>
            acc.set(
                curr.mads,
                pruneTreeByMinValue(tree, curr.size).descendants().length
            ),
        new Map<number, number>()
    );
};

const isClickPruner = (pruner: ClickPruner | any): pruner is ClickPruner => {
    return ['setCollapsedNode', 'setRootNode'].includes(pruner.key);
};

const runClickPrunes = (
    clickPruneHistory: ClickPruner[],
    tree: HierarchyNode<TMCNode>
) => {
    let i = 0;
    let _tree = tree.copy();
    while (i < clickPruneHistory.length) {
        _tree = runPrune(clickPruneHistory[i], _tree);
        i++;
    }
    return _tree;
};

const pruners = {
    minDepth: pruneTreeByDepth,
    minSize: pruneTreeByMinValue,
    minDistance: pruneTreeByMinDistance,
    minDistanceSearch: pruneTreeByMinDistanceSearch,
    setCollapsedNode: collapseNode,
    setRootNode: setRootNode,
};

const runPrune = (arg: AllPruner, tree: HierarchyNode<TMCNode>) => {
    if (!arg.key) return tree;
    if (isClickPruner(arg)) {
        return pruners[arg.key as ClickPruneType](tree, arg.value!);
    } else {
        return pruners[arg.key as ValuePruneType](tree, arg.value! as number);
    }
};
