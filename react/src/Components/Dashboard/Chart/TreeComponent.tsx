import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { bindActionCreators } from 'redux';
import { extent } from 'd3-array';
import { select } from 'd3-selection';
import { Tree as TreeViz } from '../../../Visualizations';
import { calculateOrdinalColorScaleRangeAndDomain } from '../../../util';

import {
    selectDisplayConfig,
    updateColorScale,
    updateLinearScale,
} from '../../../redux/displayConfigSlice';
import { TreeContext } from '../../../Visualizations/Tree';
import {
    useAppDispatch,
    useAppSelector,
    usePrunedTree,
    useSelectTree,
} from '../../../hooks';
import { useColorScale, useLinearScale } from '../../../hooks/useScale';
import { TMCHiearchyNode, TMCHierarchyPointNode } from '../../../types';
import {
    addClickPrune as _addClickPrune,
    removeClickPrune as _removeClickPrune,
    selectActivePruneStep,
} from '../../../redux/pruneSlice';
import { selectAnnotationSlice } from '../../../redux/annotationSlice';

const TreeComponent: React.FC<{ baseTree: TMCHierarchyPointNode }> = ({
    baseTree,
}) => {
    const [Tree, setTree] = useState<TreeViz>();

    const { className, selector } = useSelectTree();

    const branchSizeScale = useLinearScale('branchSizeScale');
    const { scaleFunction: colorScaleWrapper } = useColorScale();
    const pieScale = useLinearScale('pieScale');

    const treeScales = useMemo(
        () => ({
            branchSizeScale,
            colorScaleWrapper,
            pieScale,
        }),
        [branchSizeScale, colorScaleWrapper, pieScale]
    );

    const {
        toggleableFeatures,
        width,
        scales: {
            colorScale: { variant: colorScaleKey },
        },
    } = useAppSelector(selectDisplayConfig);

    const { activeFeatures } = useAppSelector(selectAnnotationSlice);

    const {
        step: { clickPruneHistory },
    } = useAppSelector(selectActivePruneStep);

    const dispatch = useAppDispatch();

    const visibleNodes = usePrunedTree(baseTree);

    const { addClickPrune, removeClickPrune } = bindActionCreators(
        {
            addClickPrune: _addClickPrune,
            removeClickPrune: _removeClickPrune,
        },
        dispatch
    );

    const context: TreeContext = React.useMemo(
        () => ({
            clickPruneCallbacks: {
                addClickPrune,
                removeClickPrune,
            },
            displayContext: {
                activeFeatures,
                clickPruneHistory,
                colorScaleKey,
                scales: treeScales,
                toggleableFeatures,
                visibleNodes,
                width,
            },
        }),
        [
            activeFeatures,
            addClickPrune,
            clickPruneHistory,
            colorScaleKey,
            removeClickPrune,
            toggleableFeatures,
            treeScales,
            visibleNodes,
            width,
        ]
    );

    /* initial scales */
    useEffect(() => {
        dispatch(
            updateLinearScale({
                branchSizeScale: {
                    domain: extent(
                        visibleNodes.descendants().map(d => +(d.value || 0))
                    ) as [number, number],
                    range: [0.1, 20],
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
                visibleNodes as TMCHiearchyNode
            );

        dispatch(updateColorScale({ labelRange, labelDomain }));
    }, []);

    /* intial render */
    useLayoutEffect(() => {
        const selection = select(selector);
        const _Tree = new TreeViz(context, selection);
        setTree(_Tree);
        _Tree.render();
    }, []);

    useEffect(() => {
        /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
        if (Tree) {
            Tree.context = context;
            Tree.render();
        }
    }, [context]);

    return (
        <div
            className={className}
            style={{ border: 'thin gray solid', width: '100%' }}
        />
    );
};

export default TreeComponent;
