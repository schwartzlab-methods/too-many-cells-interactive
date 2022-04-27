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
import { DisplayContext, PruneContext, TreeContext } from './Dashboard';

interface TreeComponentProps {
    data: HierarchyNode<TMCNode>;
}

const TreeComponent: React.FC<TreeComponentProps> = ({ data }) => {
    const [Tree, setTree] = useState<TreeViz>();

    const { displayContext, pruneContext, setDisplayContext, setPruneContext } =
        useContext(TreeContext);

    useEffect(() => {
        if (Tree) {
            Object.assign(Tree, displayContext);
            /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
            Tree.setDisplayContext = (ctx: DisplayContext) =>
                setDisplayContext(ctx);
            Tree.render();
        }
    }, [displayContext]);

    useEffect(() => {
        if (Tree) {
            Object.assign(Tree, displayContext);
            /* we have to keep this callback updated with the latest context manually b/c d3 isn't part of React */
            Tree.setPruneContext = (ctx: Partial<PruneContext>) =>
                setPruneContext(ctx);
            Tree.render();
        }
    }, [pruneContext]);

    /* todo: listen to pruneContext and calculate/set visible or root nodes, depending on value */

    const selector = useRef<string>('tree');

    useLayoutEffect(() => {
        if (data) {
            const _Tree = new TreeViz(
                `.${selector.current}`,
                '.legend',
                data,
                (ctx: DisplayContext) => setDisplayContext(ctx),
                (ctx: Partial<PruneContext>) => setPruneContext(ctx)
            );
            setTree(_Tree);
        }
    }, [data]);

    return <div className={selector.current} style={{ width: '100%' }} />;
};

export default TreeComponent;
