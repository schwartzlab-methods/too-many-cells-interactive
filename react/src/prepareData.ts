import { HierarchyNode, stratify } from 'd3-hierarchy';
import {
    TMCNode,
    TMCFlatNode,
    RoseNode,
    RoseNodeObj,
    AttributeMap,
} from './types';
import { mergeAttributeMaps } from './util';

export const buildTree = (node: TMCFlatNode[]) => {
    return (stratify<TMCFlatNode>()(node) as HierarchyNode<TMCNode>)
        .sort((a, b) => {
            const aval = a.data.items ? a.data.items.length : 0;
            const bval = b.data.items ? b.data.items.length : 0;
            return aval > bval ? -1 : 1;
        })
        .sum(d => (d.items ? d.items.length : 0));
};

const getId = () =>
    `${Math.random().toString(36).slice(2)}-${Date.now().toString(
        36
    )}-${Math.random().toString(36).slice(2)}`;

/**
 * Import TMC Rosetree, flatten, and pass to d3 hierarchy for rebuilding into
 *  tree that is compatible with D3 layout
 * Note that flattening tree as intermediate step is useful for filtering and rebuilding later on
 *
 * @returns Promise<HierarchyNode<TMCNode>> Root tree that can be passed to D3 layout
 */
export const getData = async () => {
    const labels = await (await fetch('/files/labels.csv')).text();
    const data = (await (
        await fetch('/files/cluster_tree.json')
    ).json()) as RoseNode;
    return transformData(data, labels);
};

export const transformData = (data: RoseNode, labels: string) => {
    const flat = flatten(data);
    const tree = buildTree(flat);

    return addLabels(tree, labels);
};

const addLabels = (tree: HierarchyNode<TMCNode>, labels: string) => {
    const labelMap: Record<string, string> = {};
    labels.split('\n').forEach((l: string, i: number) => {
        if (i == 0) {
            return;
        }
        const [k, v] = l.split(',');
        labelMap[k] = v;
    });

    /* compute the values for leaf nodes, merge children for non-leaves */
    return tree
        .eachAfter(n => {
            n.data.labelCount = n.data.items
                ? n.data.items.reduce<AttributeMap>(
                      (acc, curr) => ({
                          ...acc,
                          [labelMap[curr._barcode.unCell]]: {
                              quantity:
                                  (acc[labelMap[curr._barcode.unCell]]
                                      ?.quantity || 0) + 1,
                              scaleKey: labelMap[curr._barcode.unCell],
                          },
                      }),
                      {}
                  )
                : n.children!.reduce<AttributeMap>(
                      (acc, cur) =>
                          mergeAttributeMaps(acc, cur.data.labelCount),
                      {}
                  );
        })
        .eachBefore((n, i) => {
            n.data.nodeId = i;
        });
};

const flatten = (
    data: RoseNode,
    nodes: TMCFlatNode[] = [],
    parentId?: string
): TMCFlatNode[] => {
    const node = {} as TMCFlatNode;
    node.parentId = parentId;
    node.id = getId();
    const meta = data.find(content => isObject(content)) as
        | RoseNodeObj
        | undefined;

    node.items = meta?._item
        ? meta._item.map(i => ({
              ...i,
              _barcode: {
                  ...i._barcode,
                  _featureValues: {},
              },
          }))
        : null;
    node.distance = meta?._distance ?? null;
    node.significance = meta?._significance ?? null;
    node.featureHiLos = {};
    node.featureCount = {};
    node.featureAverage = {};
    nodes.push(node);
    for (const item of data) {
        if (Array.isArray(item)) {
            for (const i of item) {
                flatten(i as RoseNode, nodes, node.id);
            }
        }
    }

    return nodes;
};

const isObject = (item: any): item is object =>
    !!item && typeof item === 'object' && !Array.isArray(item);
