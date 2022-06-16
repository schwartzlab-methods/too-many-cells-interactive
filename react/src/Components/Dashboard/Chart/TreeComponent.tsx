import React, {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { bindActionCreators } from 'redux';
import { extent } from 'd3-array';
import { ScaleLinear, ScaleOrdinal } from 'd3-scale';
import { HierarchyNode, HierarchyPointNode } from 'd3-hierarchy';
import { Tree as TreeViz } from '../../../Visualizations';
import { calculateColorScaleRangeAndDomain } from '../../../util';

import {
    Scales,
    selectScales,
    selectToggleableDisplayElements,
    selectWidth,
    ToggleableDisplayElements,
    updateColorScale,
    updateLinearScale,
} from '../../../redux/displayConfigSlice';
import { useAppDispatch, useAppSelector, usePruner } from '../../../hooks';
import { useColorScale, useLinearScale } from '../../../hooks/useScale';
import { TMCNode } from '../../../types';
import {
    addClickPrune as _addClickPrune,
    ClickPruner,
    removeClickPrune as _removeClickPrune,
    selectActiveStepPruneHistory,
} from '../../../redux/pruneSlice';

interface TreeScales {
    branchSizeScale: ScaleLinear<number, number>;
    colorScale: ScaleOrdinal<string, string>;
    pieScale: ScaleLinear<number, number>;
}

type ColorScaleKey = Scales['colorScale']['variant'];

/**
 *  Class for passing context between React and D3.
 *  @method refresh must be used by React (in a useEffect hook) to keep context up to date,
 *      since Tree chart depends on it for accurate rendering and most values are controlled by React components.
 */

//need to pass in: clickPrune history, setters for....
export class ContextManager {
    addClickPrune!: (pruner: ClickPruner) => void;
    colorScaleKey!: ColorScaleKey;
    clickPruneHistory!: ClickPruner[];
    removeClickPrune!: (purner: ClickPruner) => void;
    scales!: TreeScales;
    toggleableFeatures!: ToggleableDisplayElements;
    visibleNodes!: HierarchyPointNode<TMCNode>;
    width!: number;
    constructor(
        addClickPrune: (pruner: ClickPruner) => void,
        clickPruneHistory: ClickPruner[],
        colorScaleKey: ColorScaleKey,
        removeClickPrune: (pruner: ClickPruner) => void,
        scales: TreeScales,
        toggleableFeatures: ToggleableDisplayElements,
        visibleNodes: HierarchyPointNode<TMCNode>,
        width: number
    ) {
        this.refresh(
            addClickPrune,
            clickPruneHistory,
            colorScaleKey,
            removeClickPrune,
            scales,
            toggleableFeatures,
            visibleNodes,
            width
        );
    }

    refresh = (
        addClickPrune: (pruner: ClickPruner) => void,
        clickPruneHistory: ClickPruner[],
        colorScaleKey: ColorScaleKey,
        removeClickPrune: (pruner: ClickPruner) => void,
        scales: TreeScales,
        toggleableFeatures: ToggleableDisplayElements,
        visibleNodes: HierarchyPointNode<TMCNode>,
        width: number
    ) => {
        this.addClickPrune = addClickPrune;
        this.clickPruneHistory = clickPruneHistory;
        this.colorScaleKey = colorScaleKey;
        this.removeClickPrune = removeClickPrune;
        this.scales = scales;
        this.toggleableFeatures = toggleableFeatures;
        this.visibleNodes = visibleNodes;
        this.width = width;
    };
}

const TreeComponent: React.FC<{ baseTree: HierarchyPointNode<TMCNode> }> = ({
    baseTree,
}) => {
    const [Tree, setTree] = useState<TreeViz>();

    const branchSizeScale = useLinearScale('branchSizeScale');
    const colorScale = useColorScale();
    const pieScale = useLinearScale('pieScale');

    const { variant: colorScaleKey } =
        useAppSelector(selectScales)['colorScale'];

    const treeScales = useMemo(
        () => ({
            branchSizeScale,
            colorScale,
            pieScale,
        }),
        [branchSizeScale, colorScale, pieScale]
    );

    const toggleableFeatures = useAppSelector(selectToggleableDisplayElements);
    const width = useAppSelector(selectWidth);
    const { clickPruneHistory } = useAppSelector(selectActiveStepPruneHistory);

    const dispatch = useAppDispatch();

    const { addClickPrune, removeClickPrune } = bindActionCreators(
        {
            addClickPrune: _addClickPrune,
            removeClickPrune: _removeClickPrune,
        },
        dispatch
    );

    const visibleNodes = usePruner(baseTree as HierarchyNode<TMCNode>);

    useEffect(() => {
        dispatch(
            updateLinearScale({
                branchSizeScale: {
                    domain: extent(
                        visibleNodes.descendants().map(d => +(d.value || 0))
                    ) as [number, number],
                    range: [0.01, 20],
                },
            })
        );
        dispatch(
            updateLinearScale({
                pieScale: {
                    range: [5, 20],
                    domain: extent(
                        visibleNodes.leaves().map(d => d.value!)
                    ) as [number, number],
                },
            })
        );

        dispatch(
            updateColorScale(
                calculateColorScaleRangeAndDomain(
                    'labelCount',
                    visibleNodes as HierarchyPointNode<TMCNode>
                )
            )
        );
    }, []);

    /* intial render */
    useLayoutEffect(() => {
        const Manager = new ContextManager(
            addClickPrune,
            clickPruneHistory,
            colorScaleKey,
            removeClickPrune,
            treeScales,
            toggleableFeatures,
            visibleNodes as HierarchyPointNode<TMCNode>,
            width
        );
        const _Tree = new TreeViz(Manager, '.legend', `.${selector.current}`);
        setTree(_Tree);
        _Tree.render();
    }, []);

    //todo: prune stuff has to be there too

    useEffect(() => {
        /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
        if (Tree) {
            Tree.ContextManager.refresh(
                addClickPrune,
                clickPruneHistory,
                colorScaleKey,
                removeClickPrune,
                treeScales,
                toggleableFeatures,
                visibleNodes as HierarchyPointNode<TMCNode>,
                width
            );
        }
    }, [
        clickPruneHistory,
        colorScaleKey,
        toggleableFeatures,
        treeScales,
        visibleNodes,
    ]);

    /* React executes effects in order: this must follow previous so that tree has correct context when rendering */
    useEffect(() => {
        if (Tree) {
            Tree.render();
        }
    }, [
        clickPruneHistory,
        colorScaleKey,
        toggleableFeatures,
        treeScales,
        visibleNodes,
    ]);

    const selector = useRef<string>('tree');

    return <div className={selector.current} style={{ width: '100%' }} />;
};

export default TreeComponent;
