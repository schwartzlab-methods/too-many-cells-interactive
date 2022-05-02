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
    Pruner,
    AllPruner,
    ValuePruneType,
} from './Dashboard';

interface TreeComponentProps {
    data: HierarchyNode<TMCNode>;
}

const TreeComponent: React.FC<TreeComponentProps> = ({ data }) => {
    const [Tree, setTree] = useState<TreeViz>();

    /* initialize to 1 in order to skip unecessary rerender */
    const previousPruneContext = useRef<PruneContext[]>();

    const treeContext = useContext(TreeContext);

    const { displayContext, pruneContext, setTreeContext } = treeContext;

    useEffect(() => {
        if (Tree) {
            Object.assign(Tree, displayContext);
            /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
            Tree.setTreeContext = (ctx: Partial<BaseTreeContext>) =>
                setTreeContext(ctx);

            Tree.render();
        }
    }, [displayContext, Tree, setTreeContext]);

    useEffect(() => {
        if (Tree) {
            /* 
                first, compare latest context with previous
                if latest is longer than previous
                    rerender entire tree 
                        -- keep display context
                        -- update rootPositionedNode using previous prune context as basis and rerender
                        -- all this means is Tree.rootPositionedNode = Tree.visibleNodes; Tree.rerender()
                
                
                if newlength < oldlength, then this is a revert and we need to 
                    recursive rebuild the tree using all preceding contexts, previous context doesn't matter
                
                if newlength == oldlength and latest values are empty, then this is a reset and we just need
                    Tree.visibleNodes = Tree.rootPositionedNode 
                
                if newlength == oldlength, and values are nonempty then this is a display change and we merely need to
                    diff the two latest contexts to find change
                    update visible nodes

                pruneTree needs to be an idempotent function that can be called recursively
                    - (HierarchyNode, pruneContext) => HierarchyNode
                    - once final tree has been built, calculate the layout
            */

            /* this ought to recreate everything current except revert  */

            if (previousPruneContext.current) {
                const newTree = pruneCurrentTree(
                    Tree.rootPositionedTree,
                    pruneContext,
                    previousPruneContext.current
                );

                if (newTree) {
                    Tree.visibleNodes = calculateTreeLayout(newTree, Tree.w);
                    Tree.render();
                }
            }

            previousPruneContext.current = pruneContext;

            /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
            Tree.setTreeContext = (ctx: Partial<BaseTreeContext>) =>
                setTreeContext(ctx);
        }
    }, [pruneContext, Tree, setTreeContext]);

    const selector = useRef<string>('tree');

    useLayoutEffect(() => {
        if (data) {
            const _Tree = new TreeViz(
                `.${selector.current}`,
                '.legend',
                data,
                (ctx: Partial<BaseTreeContext>) => setTreeContext(ctx)
            );
            setTree(_Tree);
        }
    }, [data]);

    return <div className={selector.current} style={{ width: '100%' }} />;
};

export default TreeComponent;

/* 
    here we pass in an entire context object (previous doesn't matter) and layer all prunes [can animate...] 
    once we introduce commit button this will be relevant
*/
//const revert = () => null;

/* 
    fast prune, for when we know there's only one transformation good for first pass under current conditions 
    assumes previous and current context have same length

    todo: when they're all zeroes cause it's returning a call for all zeroes, like they draggedt to the edge
        of the graphic
*/

const pruneCurrentTree = (
    tree: HierarchyNode<TMCNode>,
    pruneContext: PruneContext[],
    previousContext: PruneContext[] | undefined
): HierarchyNode<TMCNode> | undefined => {
    const activeContext = pruneContext[0];
    let pruner: Pruner<any>;

    if (previousContext === pruneContext) return;

    if (!previousContext) {
        //this is a first prune, so there will be only one change
        pruner = getFirstPrune(activeContext);
    } else {
        //diff the context
        const latestIdx = pruneContext.length - 1;
        const current = pruneContext[latestIdx];
        const previous = previousContext[latestIdx];
        if (
            (current.clickPruneHistory?.length || 0) >
            (previous.clickPruneHistory?.length || 0)
        ) {
            pruner = current.clickPruneHistory!.slice(-1)[0];
        } else {
            pruner = current.valuePruner;
        }
    }
    return resolvePruner(pruner, tree);
};

const getFirstPrune = (context: PruneContext) => {
    if (context.clickPruneHistory?.length) {
        return context.clickPruneHistory[0];
    } else return context.valuePruner;
};

const resolvePruner = (arg: AllPruner, tree: HierarchyNode<TMCNode>) => {
    if (!!arg.key && isClickPruner(arg)) {
        return pruners[arg.key](tree, arg.value!);
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
