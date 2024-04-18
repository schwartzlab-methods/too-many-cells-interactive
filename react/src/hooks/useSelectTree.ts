import { select, Selection } from 'd3-selection';
import { selectDisplayConfig } from '../redux/displayConfigSlice';
import { TMCHierarchyPointNode } from '../types';
import useAppSelector from './useAppSelector';

/*
   Tree is already globally persisted on the DOM, so we'll just pass around the d3 selection of the root node.
   We can't pass around the nodes themselves, however, b/c selection is not part of react and no hook fires on render
*/
const useSelectTree = () => {
    const { containerClassName: className } =
        useAppSelector(selectDisplayConfig);

    return {
        className,
        selector: `.${className}`,
        selectTree: () =>
            select(`.${className}`).select<SVGSVGElement>(
                'svg .node-container .node'
            ) as Selection<
                SVGSVGElement,
                TMCHierarchyPointNode,
                HTMLDivElement,
                unknown
            >,
    };
};

export default useSelectTree;
