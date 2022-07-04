import React, {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { bindActionCreators } from 'redux';
import { extent } from 'd3-array';
import { ScaleLinear } from 'd3-scale';
import { HierarchyPointNode } from 'd3-hierarchy';
import { Tree as TreeViz } from '../../../Visualizations';
import { calculateOrdinalColorScaleRangeAndDomain } from '../../../util';

import {
    Scales,
    selectScales,
    selectToggleableDisplayElements,
    selectWidth,
    ToggleableDisplayElements,
    updateColorScale,
    updateLinearScale,
} from '../../../redux/displayConfigSlice';
import { useAppDispatch, useAppSelector, usePrunedTree } from '../../../hooks';
import { useColorScale, useLinearScale } from '../../../hooks/useScale';
import { TMCNode } from '../../../types';
import {
    addClickPrune as _addClickPrune,
    ClickPruner,
    removeClickPrune as _removeClickPrune,
    selectActivePruneStep,
} from '../../../redux/pruneSlice';

interface TreeScales {
    branchSizeScale: ScaleLinear<number, number>;
    colorScaleWrapper: (node: HierarchyPointNode<TMCNode>) => string;
    pieScale: ScaleLinear<number, number>;
}

type ColorScaleKey = Scales['colorScale']['variant'];

/**
 *  Class for passing context between React and D3.
 *  @method refresh must be used by React (in a useEffect hook) to keep context up to date,
 *      b/c Tree chart depends on it for accurate displayConfig and update callbacks (i.e., click prunes)
 */

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
    const { scaleFunction: colorScaleWrapper } = useColorScale();
    const pieScale = useLinearScale('pieScale');

    const { variant: colorScaleKey } =
        useAppSelector(selectScales)['colorScale'];

    const treeScales = useMemo(
        () => ({
            branchSizeScale,
            colorScaleWrapper,
            pieScale,
        }),
        [branchSizeScale, colorScaleWrapper, pieScale]
    );

    const toggleableFeatures = useAppSelector(selectToggleableDisplayElements);
    const width = useAppSelector(selectWidth);
    const {
        step: { clickPruneHistory },
    } = useAppSelector(selectActivePruneStep);

    const dispatch = useAppDispatch();

    const { addClickPrune, removeClickPrune } = bindActionCreators(
        {
            addClickPrune: _addClickPrune,
            removeClickPrune: _removeClickPrune,
        },
        dispatch
    );

    const visibleNodes = usePrunedTree(baseTree);

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

        const { range: labelRange, domain: labelDomain } =
            calculateOrdinalColorScaleRangeAndDomain(
                'labelCount',
                visibleNodes as HierarchyPointNode<TMCNode>
            );

        dispatch(updateColorScale({ labelRange, labelDomain }));
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
