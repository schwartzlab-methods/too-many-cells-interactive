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
import { TMCNode } from '../../../types';
import { Tree as TreeViz } from '../../../Visualizations';
import { getData } from '../../../prepareData';
import { interpolateColorScale } from '../../../Visualizations/Tree';
import {
    calculateTreeLayout,
    collapseNode,
    pruneContextsAreEqual,
    pruneTreeByDepth,
    pruneTreeByMinDistance,
    pruneTreeByMinDistanceSearch,
    pruneTreeByMinValue,
    setRootNode,
} from '../../../util';
import {
    ClickPruner,
    PruneContext,
    TreeContext,
    BaseTreeContext,
    AllPruner,
    ValuePruneType,
    ClickPruneType,
    DisplayContext,
} from '../Dashboard';

/**
 *  Class for passing context between React and D3.
 *  @method refresh must be used by React (in a useEffect hook) to keep context up to date,
 *      since Tree chart depends on it for accurate rendering and most values are controlled by React components.
 */
export class ContextManager {
    activePruneStep!: PruneContext;
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
        this.activePruneStep = this.pruneContext[this.context.activePrune];
        this.displayContext = this.context
            .displayContext as Required<DisplayContext>;
        this.setContext = setContext;
        this.setPruneContext = this.context.setPruneContext;
    };
}

const TreeComponent: React.FC = () => {
    const [Tree, setTree] = useState<TreeViz>();

    const treeContext = useContext(TreeContext);

    const {
        activePrune,
        displayContext,
        pruneContext,
        setDisplayContext,
        setTreeContext,
    } = treeContext;

    const previousContext = useRef<Readonly<TreeContext>>(treeContext);

    /* Initialize tree context on first render  */
    useEffect(() => {
        const cb = async () => {
            const data = await getData();
            const w = 1000;
            const rootPositionedTree = calculateTreeLayout(data, w);
            const originalTree = calculateTreeLayout(data, w);
            const visibleNodes = calculateTreeLayout(data, w);
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
                colorScale: scaleOrdinal(scaleColors).domain(labels),
                nodeCountsVisible: false,
                opacityScale: () => 1,
                nodeIdsVisible: false,
                originalTree,
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
                visibleNodes,
                w,
            });
        };
        cb();
    }, []);

    /* intial render */
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

    /* React executes effects in order: this must follow previous so that tree has correct context when rendering */
    useEffect(() => {
        if (Tree) {
            Tree.render();
        }
    }, [displayContext]);

    /* 
        This effect 'watches' prune context, creates new pruned tree, and updates display context. 
        Note that this should never call setContext itself, its job is to translate PruneContext to DisplayContext.
    
    */
    useEffect(() => {
        const { pruneContext: previousPrune, activePrune: previousActive } =
            previousContext.current;

        if (Tree) {
            if (previousPrune.length < pruneContext.length) {
                /* 
                    if new context is longer than previous context, this is a new step.
                */
                setDisplayContext({
                    rootPositionedTree: displayContext.visibleNodes,
                });
            } else if (previousActive !== activePrune) {
                /* 
                     When changing from one existing step to another we need to rerun all previous prunes. 
                        For each pruner, we'll first run the value pruner (if any), then the click pruners. 
                */
                let _rootPositionedTree =
                    displayContext.originalTree!.copy() as HierarchyNode<TMCNode>;
                let _visibleNodes =
                    displayContext.originalTree!.copy() as HierarchyNode<TMCNode>;

                let i = 0;
                while (i <= activePrune) {
                    _visibleNodes = runPrune(
                        pruneContext[i].valuePruner,
                        _visibleNodes
                    );

                    _visibleNodes = runClickPrunes(
                        pruneContext[i].clickPruneHistory,
                        _visibleNodes
                    );
                    /* the rootPositionedNode for this step will actually be the tree from the previous step's prune */
                    if (activePrune > 0 && i === activePrune - 1) {
                        _rootPositionedTree = _visibleNodes.copy();
                    }
                    i++;
                }

                const visibleNodes = calculateTreeLayout(
                    _visibleNodes,
                    displayContext.w!
                );
                const rootPositionedTree = calculateTreeLayout(
                    _rootPositionedTree,
                    displayContext.w!
                );

                setDisplayContext({
                    rootPositionedTree,
                    visibleNodes,
                });
            } else if (
                !pruneContextsAreEqual(
                    previousPrune[activePrune],
                    pruneContext[activePrune]
                )
            ) {
                /* 
                    If we haven't changed or added steps and prune context has changed, prune the tree. 
                    Because click history can change in both directions, we need to rerun from root every time.
                    It's possible to optimize this to skip the redundant prunes.
                */

                let newTree = runPrune(
                    pruneContext[activePrune].valuePruner,
                    displayContext.rootPositionedTree!
                );

                newTree = runClickPrunes(
                    pruneContext[activePrune].clickPruneHistory,
                    newTree
                );

                setDisplayContext({
                    visibleNodes: calculateTreeLayout(
                        newTree,
                        displayContext.w!
                    ),
                });
            }
        }
        //note right now that previous value is not reliable component-wide, should be used only in this hook!
        previousContext.current = treeContext;
    }, [activePrune, pruneContext]);

    const selector = useRef<string>('tree');

    return <div className={selector.current} style={{ width: '100%' }} />;
};

export default TreeComponent;

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
