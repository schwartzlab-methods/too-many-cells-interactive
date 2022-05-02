import React, {
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { HierarchyNode } from 'd3-hierarchy';
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

interface TreeComponentProps {
    data: HierarchyNode<TMCNode>;
}

export class ContextManager {
    private context!: TreeContext;
    pruneContext!: Readonly<PruneContext[]>;
    displayContext!: Readonly<DisplayContext>;
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
        this.displayContext = this.context.displayContext;
        this.setContext = setContext;
        this.setPruneContext = this.context.setPruneContext;
    };
}

const TreeComponent: React.FC<TreeComponentProps> = ({ data }) => {
    const [Tree, setTree] = useState<TreeViz>();

    /* initialize to 1 in order to skip unecessary rerender */
    const previousPruneContext = useRef<Readonly<PruneContext[]>>();

    const treeContext = useContext(TreeContext);

    const { displayContext, pruneContext, setTreeContext } = treeContext;

    useEffect(() => {
        if (Tree) {
            Object.assign(Tree, displayContext);
            Tree.render();
        }
    }, [displayContext]);

    useEffect(() => {
        if (Tree) {
            /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
            Tree.ContextManager.refresh(treeContext, setTreeContext);
        }
    }, [treeContext, setTreeContext]);

    /* 
        todo: 
            - extract conditionals into semantically-named functions
            - consolidate state by moving everything that's in context manager out of Tree
                - this means initilializing these properties (including scales, visibleNodes and rootPositionedTree)
                    in this component. That way, they'll never be undefined.
                - it also means further wrapping the (a) updateContext function so that it will handle updating React and D3 context values at once
                    - this is especially important for the first 3 codepaths
                        - here's we're updating display context? yeah, that's a better pattern,
                            this function will update display context (which will contain root and visible nodes)
                            and useEffect that watches only display context will take care of rerender
                        - but note that the call to object.assign() is at cross-purposes with ContextManager
                        - what it out to do is update (display)ContextManager and rerender, which formalizes the process
            - to recap:
                put visible nodes and rootpositionedtree on contextManager
                set contextManager values ahead of time and pass to constructor, removing those properties from Tree
                have the dispaycontext useEffect update the manager and call render, rather than using object.assign
                the below should not make calls to setTreeContext but instead setDisplayContext, letting the parent take care of the rerender
                

    */

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
                Tree.rootPositionedTree = Tree.visibleNodes = Tree.originalTree;
                setTreeContext({
                    rootPositionedTree: Tree.rootPositionedTree,
                    visibleNodes: Tree.visibleNodes,
                });
                Tree.render();
            } else if (
                previousPruneContext.current &&
                previousPruneContext.current.length < pruneContext.length
            ) {
                /* 
                    if latest is longer than previous rerender tree using previous prune context as basis
                */
                Tree.rootPositionedTree = Tree.visibleNodes;
                setTreeContext({ rootPositionedTree: Tree.visibleNodes });
                Tree.render();
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

                Tree.visibleNodes = Tree.rootPositionedTree =
                    calculateTreeLayout(_tree, Tree.w);

                setTreeContext({
                    rootPositionedTree: Tree.rootPositionedTree,
                    visibleNodes: Tree.visibleNodes,
                });

                Tree.render();
            } else if (
                previousPruneContext.current &&
                pruneContextIsEmpty(pruneContext.slice(-1)[0])
            ) {
                /* 
                    if previous exists and current is empty (and above is false), this is a refresh,
                    so just set visible nodes to all nodes
                */
                Tree.visibleNodes = Tree.rootPositionedTree;
                setTreeContext({ visibleNodes: Tree.visibleNodes });
                Tree.render();
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
                    Tree.rootPositionedTree.copy(),
                    current,
                    previous
                )!;
                Tree.visibleNodes = calculateTreeLayout(newTree, Tree.w);
                Tree.render();
            }

            previousPruneContext.current = pruneContext;
        }
    }, [pruneContext]);

    const selector = useRef<string>('tree');

    useLayoutEffect(() => {
        if (data) {
            const Manager = new ContextManager(treeContext, setTreeContext);
            const _Tree = new TreeViz(
                Manager,
                '.legend',
                `.${selector.current}`,
                data
            );
            setTree(_Tree);
        }
    }, [data]);

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
