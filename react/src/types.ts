import { HierarchyPointLink, HierarchyPointNode } from 'd3-hierarchy';

export interface RoseNodeItem {
    _barcode: { unCell: string };
    _cellRow: { unRow: number };
}

export interface RoseNodeObj {
    _item: RoseNodeItem[] | null;
    _distance: number | null;
    _significance: number | null;
}

export type RoseNode = [RoseNodeObj, RoseNode[][]] | [][];

export interface TMCFlatNode {
    distance: number | null;
    id: string;
    items: RoseNodeItem[] | null;
    labelCount?: Record<string, number>;
    nodeId?: number;
    parentId: string | undefined;
    significance: number | null;
}

export interface TMCNode extends TMCFlatNode {
    labelCount: Record<string, number>;
    nodeId: number;
}

export const isLinkNode = (
    item: HierarchyPointLink<TMCNode> | HierarchyPointNode<TMCNode>
): item is HierarchyPointLink<TMCNode> =>
    !!(item as HierarchyPointLink<TMCNode>).source;
