//import data from './data/workshop/cluster_tree.json';
//import labels from './data/workshop/labels.csv';
import data from './data/tabula_muris_all_simple/cluster_tree.json';
import labels from './data/tabula_muris_all_simple/labels.csv';
import { uuid } from 'lodash-uuid';
import { TMCNodeBase, TMCNode } from './types';
import { hierarchize } from './util';
import { HierarchyNode } from 'd3-hierarchy';

export const getData = () => {
    const treelike = makeNode(data);
    const hiearchized = hierarchize(treelike) as HierarchyNode<TMCNode>;
    const labelMap: Record<string, string> = {};
    labels.split('\n').forEach((l: string, i: number) => {
        if (i == 0) {
            return;
        }
        const [k, v] = l.split(',');
        labelMap[k] = v;
    });

    return hiearchized
        .copy()
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

const makeNode = (
    data: Record<string, any>[][] | Record<string, any>[],
    parent?: TMCNodeBase
): TMCNodeBase => {
    const node = {} as TMCNodeBase;
    node.parent = parent;
    node.id = uuid();
    const meta = data.find(content => isObject(content));
    node.items = meta?._item;
    node.distance = meta?._distance;
    node.significance = meta?._significance;
    let children = data.filter(item => Array.isArray(item)).flat() as Record<
        string,
        any
    >[][];
    node.children = children.map(child => makeNode(child, node));
    return node;
};

export default makeNode(data);
