import React, {
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { HierarchyNode, tree } from 'd3-hierarchy';
import { TMCNode } from '../../types';
import { Tree as TreeViz } from '../../Visualizations';
import {
    calculateTreeLayout,
    collapseNode,
    pruneContextIsEmpty,
    pruneTreeByDepth,
    pruneTreeByMinDistance,
    pruneTreeByMinDistanceSearch,
    pruneTreeByMinValue,
    setRootNode,
} from '../../util';
import {
    ClickPruner,
    PruneContext,
    TreeContext,
    BaseTreeContext,
    AllPruner,
    ValuePruneType,
    ClickPruneType,
    DisplayContext,
} from './Dashboard';

export class ContextManager {
    private context!: TreeContext;
    pruneContext!: Readonly<PruneContext[]>;
    displayContext!: Readonly<Required<DisplayContext>>;
    setContext!: (ctx: Partial<TreeContext>) => void;
    setPruneContext!: (ctx: Partial<PruneContext>) => void;
    constructor(
        context: TreeContext,
        setContext: (ctx: Partial<BaseTreeContext>) => void
    ) {
        this.refresh(context, setContext);
    }

    refresh = (
        context: TreeContext,
        setContext: (ctx: Partial<BaseTreeContext>) => void
    ) => {
        this.context = context;
        this.pruneContext = this.context.pruneContext;
        this.displayContext = this.context
            .displayContext as Required<DisplayContext>;
        this.setContext = setContext;
        this.setPruneContext = this.context.setPruneContext;
    };
}

const TreeComponent: React.FC = () => {
    const [Tree, setTree] = useState<TreeViz>();

    const previousPruneContext = useRef<Readonly<PruneContext[]>>();

    const treeContext = useContext(TreeContext);

    const { displayContext, pruneContext, setDisplayContext, setTreeContext } =
        treeContext;

    useLayoutEffect(() => {
        if (treeContext.displayContext.rootPositionedTree && !Tree) {
            const Manager = new ContextManager(treeContext, setTreeContext);
            const _Tree = new TreeViz(
                Manager,
                '.legend',
                `.${selector.current}`
            );
            setTree(_Tree);
            _Tree.render();
        }
    }, [treeContext]);

    useEffect(() => {
        if (Tree) {
            Tree.ContextManager.refresh(treeContext, setTreeContext);
            Tree.render();
        }
    }, [displayContext]);

    useEffect(() => {
        if (Tree) {
            /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
            Tree.ContextManager.refresh(treeContext, setTreeContext);
        }
    }, [treeContext, setTreeContext]);

    /* TODO: these conditionals should be semantic */
    useEffect(() => {
        if (Tree && previousPruneContext.current !== pruneContext) {
            if (
                previousPruneContext.current &&
                pruneContext.length === 1 &&
                pruneContextIsEmpty(pruneContext[0])
            ) {
                /* 
                    if previous exists and current is length 1 and empty, this is a refresh
                */
                setDisplayContext({
                    rootPositionedTree: Tree.originalTree,
                    visibleNodes: Tree.originalTree,
                });
            } else if (
                previousPruneContext.current &&
                previousPruneContext.current.length < pruneContext.length
            ) {
                /* 
                    if latest is longer than previous rerender tree using previous prune context as basis
                */
                setDisplayContext({
                    rootPositionedTree: displayContext.visibleNodes,
                });
            } else if (
                previousPruneContext.current &&
                previousPruneContext.current.length > pruneContext.length
            ) {
                /* 
                    if latest is shorter than previous, then this is a revert and we need to rerun all prunes  
                    for each pruner, we'll first run the value pruner (if any), then the click pruners,
                        since the former will always be prior to the latter (value pruners will reset click pruners)
                */
                let i = 0;
                let _tree = Tree.originalTree.copy() as HierarchyNode<TMCNode>;
                while (i < pruneContext.length) {
                    _tree = runPrune(pruneContext[i].valuePruner, _tree);
                    _tree = runClickPrunes(
                        pruneContext[i].clickPruneHistory,
                        _tree
                    );
                    i++;
                }

                const newTree = calculateTreeLayout(_tree, displayContext.w!);

                setDisplayContext({
                    rootPositionedTree: newTree,
                    visibleNodes: newTree,
                });
            } else if (
                previousPruneContext.current &&
                pruneContextIsEmpty(pruneContext.slice(-1)[0])
            ) {
                /* 
                    if previous exists and current is empty (and above is false), this is a refresh,
                    so just set visible nodes to all nodes
                */
                setDisplayContext({
                    visibleNodes: displayContext.rootPositionedTree,
                });
            } else if (
                /* execute change to current pruning context */
                !previousPruneContext.current ||
                previousPruneContext.current.length === pruneContext.length
            ) {
                const latestIdx = pruneContext.length - 1;
                const current = pruneContext[latestIdx];
                const previous = previousPruneContext.current
                    ? previousPruneContext.current[latestIdx]
                    : undefined;

                const newTree = pruneTree(
                    displayContext.rootPositionedTree!.copy(),
                    current,
                    previous
                )!;
                setDisplayContext({
                    visibleNodes: calculateTreeLayout(
                        newTree,
                        displayContext.w!
                    ),
                });
            }

            previousPruneContext.current = pruneContext;
        }
    }, [pruneContext]);

    const selector = useRef<string>('tree');

    return <div className={selector.current} style={{ width: '100%' }} />;
};

export default TreeComponent;

const pruneTree = (
    tree: HierarchyNode<TMCNode>,
    pruneContext: PruneContext,
    previousContext: PruneContext | undefined
): HierarchyNode<TMCNode> | undefined => {
    if (
        (pruneContext.clickPruneHistory?.length || 0) !==
        (previousContext?.clickPruneHistory?.length || 0)
    ) {
        return runClickPrunes(pruneContext.clickPruneHistory, tree);
    } else {
        return runPrune(pruneContext.valuePruner, tree);
    }
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

const runPrune = (arg: AllPruner, tree: HierarchyNode<TMCNode>) => {
    if (!arg.key) return tree;
    if (isClickPruner(arg)) {
        return pruners[arg.key as ClickPruneType](tree, arg.value!);
    } else {
        return pruners[arg.key as ValuePruneType](tree, arg.value! as number);
    }
};

const pruners = {
    minDepth: pruneTreeByDepth,
    minSize: pruneTreeByMinValue,
    minDistance: pruneTreeByMinDistance,
    minDistanceSearch: pruneTreeByMinDistanceSearch,
    setCollapsedNode: collapseNode,
    setRootNode: setRootNode,
};

const isClickPruner = (pruner: ClickPruner | any): pruner is ClickPruner => {
    return ['setCollapsedNode', 'setRootNode'].includes(pruner.key);
};
