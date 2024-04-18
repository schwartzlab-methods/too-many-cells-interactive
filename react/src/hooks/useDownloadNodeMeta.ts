import { saveAs } from 'file-saver';
import {
    EmptyRoseNode,
    RoseNode,
    RoseNodeObj,
    TMCHierarchyDataNode,
    TMCNode,
} from '../types';
import { getKeys } from '../util';
import useSelectTree from './useSelectTree';

/**
 * "Flatten" a node into a mapping of key-value pairs
 *
 * @param {TMCHierarchyDataNode} node
 * @return {Record<string, string | number>}
 */
const transformNode = (node: TMCHierarchyDataNode) => {
    return {
        node_id: node.data.originalNodeId,
        parent_id: node.parent?.data.originalNodeId,
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

/**
 * Add `children` to TMCNode
 *
 * @param {TMCHierarchyDataNode} node the tree
 * @return {ExportNode} the tree with `children`
 */
const mapMeta = (node: TMCHierarchyDataNode) => {
    const data: ExportNode = node.data;
    if (node.children) {
        data.children = node.children.map(mapMeta);
    }
    return data;
};

/**
 * Transform the tree to the desired format (csv, json, cluster tree) and save
 *
 * @return {void}
 */
const useDownloadNodeMeta = () => {
    const { selectTree } = useSelectTree();

    const _rows: Record<string, any>[] = [];

    return (type: 'csv' | 'json' | 'cluster') => {
        if (selectTree() && !selectTree().empty() && selectTree().datum()) {
            const tree = selectTree();
            if (type === 'json') {
                saveAs(
                    `data:text/json,${encodeURIComponent(
                        JSON.stringify(mapMeta(tree.datum().copy()))
                    )}`,
                    'node-export.json'
                );
            } else if (type === 'csv') {
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
            } else if (type === 'cluster') {
                saveAs(
                    `data:text/json,${encodeURIComponent(
                        JSON.stringify(
                            convertToClusterTree(tree.datum(), [
                                {} as RoseNodeObj,
                                [],
                            ])
                        )
                    )}`,
                    'cluster-tree-export.json'
                );
            }
        }
    };
};

/**
 * Transform the tree back into its original structure (similar to cluster_tree.json)
 *
 * @param {TMCHierarchyDataNode} tree
 * @param {EmptyRoseNode} roseNode
 * @return {RoseNode}
 */
const convertToClusterTree = (
    tree: TMCHierarchyDataNode,
    roseNode: EmptyRoseNode
): RoseNode => {
    const [item] = roseNode;

    item._item = tree.data.items
        ? tree.data.items.map(item => ({
              ...item,
              _barcode: {
                  unCell: item._barcode.unCell,
              },
          }))
        : null;

    item._significance = tree.data.significance;
    item._distance = tree.data.distance;

    const newNode = [item, []] as RoseNode;

    if (tree.children) {
        newNode[1] = tree.children.map(child =>
            convertToClusterTree(child, [{} as RoseNodeObj, []])
        );
    } else {
        newNode[1] = [];
    }

    return newNode;
};

export default useDownloadNodeMeta;
