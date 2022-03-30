//import data from "./data/workshop/cluster_tree.json";
//import labels from "./data/workshop/labels.csv";
import data from './data/tabula_muris_all_simple/cluster_tree.json';
import labels from './data/tabula_muris_all_simple/labels.csv';

import { uuid } from 'lodash-uuid';

interface Item {
    _barcode: { unCell: string };
    _cellRow: { unRow: number };
}

export const labelMap: Record<string, string> = {};

labels.split('\n').forEach((l: string, i: number) => {
    if (i == 0) {
        return;
    }
    const [k, v] = l.split(',');
    labelMap[k] = v;
});

const isObject = (item: any): item is object =>
    !!item && typeof item === 'object' && !Array.isArray(item);

export interface TMCNodeBase {
    parent: TMCNodeBase | undefined;
    children: TMCNodeBase[] | null;
    id: string;
    items: Item[] | null;
    distance: number | null;
    significance: number | null;
}

const makeNode = (
    data: Record<string, any>[][] | Record<string, any>[],
    parent?: TMCNodeBase
) => {
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
