import { HierarchyPointLink, HierarchyPointNode } from 'd3-hierarchy';

interface Item {
    _barcode: { unCell: string };
    _cellRow: { unRow: number };
}

export interface TMCNodeBase {
    parent: TMCNodeBase | undefined;
    children: TMCNodeBase[] | null;
    id: string;
    items: Item[] | null;
    distance: number | null;
    significance: number | null;
}

export interface TMCNode extends TMCNodeBase {
    labelCount: Record<string, number>;
    nodeId: number;
}

export const isLinkNode = (
    item: HierarchyPointLink<TMCNode> | HierarchyPointNode<TMCNode>
): item is HierarchyPointLink<TMCNode> =>
    !!(item as HierarchyPointLink<TMCNode>).source;
