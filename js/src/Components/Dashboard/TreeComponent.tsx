import React, {
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { HierarchyNode } from 'd3-hierarchy';
import { TMCNode } from './../../types';
import { Tree as TreeViz } from './../../Visualizations';
import { BaseTreeContext, TreeContext } from './Dashboard';

interface TreeComponentProps {
    data: HierarchyNode<TMCNode>;
    onLoad: (tree: TreeViz) => void;
}

const TreeComponent: React.FC<TreeComponentProps> = ({ data, onLoad }) => {
    const [Tree, setTree] = useState<TreeViz>();

    const treeContext = useContext(TreeContext);

    useEffect(() => {
        if (Tree) {
            Object.assign(Tree, treeContext);
            /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
            Tree.setContext = (ctx: BaseTreeContext) =>
                treeContext.setTreeContext!({ ...treeContext, ...ctx });
            Tree.render();
        }
    }, [treeContext]);

    const selector = useRef<string>('tree');

    useLayoutEffect(() => {
        if (data) {
            const _Tree = new TreeViz(
                `.${selector.current}`,
                '.legend',
                data,
                (ctx: BaseTreeContext) =>
                    treeContext.setTreeContext!({ ...treeContext, ...ctx })
            );
            setTree(_Tree);
            _Tree.render();
            onLoad(_Tree);
        }
    }, [data]);

    return <div className={selector.current} style={{ width: '100%' }} />;
};

export default TreeComponent;
