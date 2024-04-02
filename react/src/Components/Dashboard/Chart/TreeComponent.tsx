import React, {
    forwardRef,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react';
import { bindActionCreators } from 'redux';
import { extent } from 'd3-array';
import { select } from 'd3-selection';
import { Tree as TreeViz } from '../../../Visualizations';

import {
    selectDisplayConfig,
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
import { TMCHierarchyPointNode } from '../../../types';
import {
    addClickPrune as _addClickPrune,
    removeClickPrune as _removeClickPrune,
    selectActivePruneStep,
} from '../../../redux/pruneSlice';
import { selectAnnotationSlice } from '../../../redux/annotationSlice';

/**
 * React component that wraps the main tree visualization, providing initial arguments from state and
 * forwarding redux state tree changes to the d3 context object (since d3 is not part of react tree).
 * Renders a div with a selector for d3 to attach to.
 */
const TreeComponent = forwardRef<
    HTMLDivElement,
    { baseTree: TMCHierarchyPointNode }
>(({ baseTree }, ref) => {
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

    const { scales } = useAppSelector(selectDisplayConfig);

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
                    range: scales.branchSizeScale.defaultRange,
                },
            })
        );
        dispatch(
            updateLinearScale({
                pieScale: {
                    domain: extent(
                        visibleNodes.leaves().map(d => d.value!)
                    ) as [number, number],
                    range: scales.pieScale.defaultRange,
                },
            })
        );

        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* intial render */
    useLayoutEffect(() => {
        const selection = select(selector);
        const _Tree = new TreeViz(context, selection);
        setTree(_Tree);
        _Tree.render();
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
        if (Tree) {
            Tree.context = context;
            Tree.render();
        }
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [context]);

    return (
        <div
            ref={ref}
            className={className}
            style={{ border: 'thin gray solid', width: '100%' }}
        />
    );
});

TreeComponent.displayName = 'TreeComponent';

export default TreeComponent;
