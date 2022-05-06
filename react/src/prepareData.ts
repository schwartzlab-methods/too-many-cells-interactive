import { uuid } from 'lodash-uuid';
import { TMCNode, TMCFlatNode, RoseNode, RoseNodeObj } from './types';
import { HierarchyNode, stratify } from 'd3-hierarchy';

export const buildTree = (node: TMCFlatNode[]) => {
    return (stratify<TMCFlatNode>()(node) as HierarchyNode<TMCNode>)
        .sort((a, b) => {
            const aval = a.data.items ? a.data.items.length : 0;
            const bval = b.data.items ? b.data.items.length : 0;
            return aval > bval ? -1 : 1;
        })
        .sum(d => (d.items ? d.items.length : 0));
};

/**
 * Import TMC Rosetree, flatten, and pass to d3 hierarchy for rebuilding into
 *  tree that is compatible with D3 layout
 * Flattening tree as intermediate step is useful for filtering and rebuilding later on
 *
 * @returns HierarchyNode<TMCNode> Root tree that can be passed to D3 layout
 */
export const getData = async () => {
    const labels = await (await fetch('/files/labels.csv')).text();
    const data = await (await fetch('/files/cluster_tree.json')).json();

    const flat = flatten(data as RoseNode);
    const tree = buildTree(flat);
    const labelMap: Record<string, string> = {};
    labels.split('\n').forEach((l: string, i: number) => {
        if (i == 0) {
            return;
        }
        const [k, v] = l.split(',');
        labelMap[k] = v;
    });

    return tree
        .eachAfter(n => {
            n.data.labelCount = n
                .descendants()
                .reduce<Record<string, number>>((acc, curr) => {
                    if (curr.data.items) {
                        curr.data.items.forEach(item => {
                            acc[labelMap[item._barcode.unCell]] =
                                (acc[labelMap[item._barcode.unCell]] || 0) + 1;
                        });
                    }
                    return acc;
                }, {});
        })
        .eachBefore((n, i) => {
            n.data.nodeId = i;
        });
};

const isObject = (item: any): item is object =>
    !!item && typeof item === 'object' && !Array.isArray(item);

const flatten = (
    data: RoseNode,
    nodes: TMCFlatNode[] = [],
    parentId?: string
): TMCFlatNode[] => {
    const node = {} as TMCFlatNode;
    node.parentId = parentId;
    node.id = uuid();
    const meta = data.find(content => isObject(content)) as
        | RoseNodeObj
        | undefined;

    node.items = meta?._item ?? null;
    node.distance = meta?._distance ?? null;
    node.significance = meta?._significance ?? null;
    nodes.push(node);
    for (let item of data) {
        if (Array.isArray(item)) {
            for (let i of item) {
                flatten(i as RoseNode, nodes, node.id);
            }
        }
    }

    return nodes;
};
