import React, {
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { extent } from 'd3-array';
import { HierarchyNode } from 'd3-hierarchy';
import { scaleLinear, scaleOrdinal } from 'd3-scale';
import { TMCNode } from '../../types';
import { Tree as TreeViz } from '../../Visualizations';
import { getData } from '../../prepareData';
import { interpolateColorScale } from '../../Visualizations/Tree';
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

/**
 *  Class for passing context between React and D3.
 *  @method refresh must be used by React (in a useEffect hook) to keep context up to date,
 *      since Tree chart depends on it for accurate rendering and most values are controlled by React components.
 */
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

    /* Initialize tree context on first render  */
    useEffect(() => {
        const cb = async () => {
            const data = await getData();
            const w = 1000;
            const rootPositionedTree = calculateTreeLayout(data, w);
            const labels = Array.from(
                new Set(
                    rootPositionedTree
                        .descendants()
                        .flatMap(d => Object.keys(d.data.labelCount))
                )
            ).filter(Boolean) as string[];
            const scaleColors = interpolateColorScale(labels);

            setDisplayContext({
                branchSizeScale: scaleLinear([0.01, 20])
                    .domain(
                        extent(
                            rootPositionedTree
                                .descendants()
                                .map(d => +(d.value || 0))
                        ) as [number, number]
                    )
                    .clamp(true),
                distanceVisible: false,
                labelScale: scaleOrdinal(scaleColors).domain(labels),
                nodeCountsVisible: false,
                nodeIdsVisible: false,
                pieScale: scaleLinear([5, 20])
                    .domain(
                        extent(
                            rootPositionedTree.leaves().map(d => d.value!)
                        ) as [number, number]
                    )
                    .clamp(true),
                piesVisible: true,
                rootPositionedTree,
                strokeVisible: false,
                visibleNodes: rootPositionedTree,
                w,
            });
        };
        cb();
    }, []);

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
        /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
        if (Tree) {
            Tree.ContextManager.refresh(treeContext, setTreeContext);
        }
    }, [treeContext, setTreeContext]);

    /* React executes effects in order: this must follow previous so that tree has correct context when renderin */
    useEffect(() => {
        if (Tree) {
            Tree.render();
        }
    }, [displayContext]);

    /* 
        This effect 'watches' prune context, creates new pruned tree, and updates display context, avoiding extra steps
            whenever possible to increase speed. For this reason, order of conditionals is important. 

        todo: don't need to save previous, actually --> we can possibly even split up these actions
            that is, we can have a separate useEffect that watches activeStep and acts accordingly
            it can save previous step
        
    */
    useEffect(() => {
        if (Tree && previousPruneContext.current !== pruneContext) {
            if (
                previousPruneContext.current &&
                pruneContext.length === 1 &&
                pruneContextIsEmpty(pruneContext[0])
            ) {
                /* 
                    if previous exists and current is length 1 and empty, this is a total refresh
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
                    if latest is longer than previous, this is a new step
                */
                setDisplayContext({
                    rootPositionedTree: displayContext.visibleNodes,
                });
            } else if (
                previousPruneContext.current &&
                previousPruneContext.current.length > pruneContext.length
            ) {
                /* 
                    If latest is shorter than previous, then this is a revert to an intermediate step 
                        and we need to rerun all prunes. For each pruner, we'll first run the value pruner 
                        (if any), then the click pruners, since the former will always be prior to the 
                        latter (value pruners reset click pruners).
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
                    if previous exists and current is empty (and above is false), this is a current-step refresh,
                */
                setDisplayContext({
                    visibleNodes: displayContext.rootPositionedTree,
                });
            } else if (
                /* this is a change to the present step*/
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
