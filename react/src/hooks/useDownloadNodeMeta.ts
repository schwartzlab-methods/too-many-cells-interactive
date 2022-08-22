import { saveAs } from 'file-saver';
import { TMCHierarchyDataNode, TMCNode } from '../types';
import { getKeys } from '../util';
import useSelectTree from './useSelectTree';

const transformNode = (node: TMCHierarchyDataNode) => {
    return {
        node_id: node.data.nodeId,
        parent_id: node.parent?.data.nodeId,
        item_count: node.value || 0,
        child_count:
            node.descendants().length - 1 > 0
                ? node.descendants().length - 1
                : 0,
        distance: node.data.distance,
    };
};

interface ExportNode extends TMCNode {
    children?: ExportNode[];
}

const mapMeta = (node: TMCHierarchyDataNode) => {
    const data: ExportNode = node.data;
    if (node.children) {
        data.children = node.children.map(mapMeta);
    }
    return data;
};

const useDownloadNodeMeta = () => {
    const { selectTree } = useSelectTree();

    const _rows: Record<string, any>[] = [];

    return (type: 'csv' | 'json') => {
        if (selectTree() && !selectTree().empty() && selectTree().datum()) {
            const tree = selectTree();
            if (type === 'json') {
                saveAs(
                    `data:text/json,${encodeURIComponent(
                        JSON.stringify(mapMeta(tree.datum().copy()))
                    )}`,
                    'node-export.json'
                );
            } else {
                tree.datum().eachBefore(node =>
                    _rows.push(transformNode(node))
                );
                if (_rows.length) {
                    const headers = getKeys(_rows[0]).join(',');
                    const rows = _rows.reduce(
                        (acc, curr) =>
                            (acc += Object.values(curr).join(',') + '\n'),
                        ''
                    );
                    saveAs(
                        `data:text/csv,${encodeURIComponent(
                            `${headers}\n${rows}`
                        )}`,
                        'node-export.csv'
                    );
                }
            }
        }
    };
};

export default useDownloadNodeMeta;
