import { HierarchyPointLink, HierarchyPointNode } from 'd3-hierarchy';
import { ScaleLinear, ScaleOrdinal, ScaleThreshold } from 'd3-scale';
import { isNumber } from 'lodash';

export interface RoseNodeItem {
    _barcode: { unCell: string };
    _cellRow: { unRow: number };
}

/* 
    _featureCounts here is raw count for cell, which must persist on object for further processing
    node.featureHiLos contains calculated display values that may change according to user interaction
*/
export interface TMCNodeItem extends RoseNodeItem {
    _barcode: {
        unCell: string;
        _featureCounts: Record<string, number | undefined>;
    };
}

export interface RoseNodeObj {
    _item: RoseNodeItem[] | null;
    _distance: number | null;
    _significance: number | null;
}

export type RoseNode = [RoseNodeObj, RoseNode[][]] | [][];

export interface AttributeMapValue {
    quantity: number;
    scaleKey: string | number;
}

export type AttributeMap = Record<string, AttributeMapValue>;

export interface TMCFlatNode {
    distance: number | null;
    id: string;
    featureCount: AttributeMap;
    featureHiLos: AttributeMap;
    items: TMCNodeItem[] | null;
    labelCount?: AttributeMap;
    nodeId?: number;
    parentId: string | undefined;
    significance: number | null;
}

export interface TMCNode extends TMCFlatNode {
    labelCount: AttributeMap;
    nodeId: number;
}

export const isLinkNode = (
    item: HierarchyPointLink<TMCNode> | HierarchyPointNode<TMCNode>
): item is HierarchyPointLink<TMCNode> =>
    !!(item as HierarchyPointLink<TMCNode>).source;

export const scaleIsThreshold = (
    scale: ScaleOrdinal<string, string> | ScaleThreshold<any, any>
): scale is ScaleThreshold<any, any> =>
    !!(scale as ScaleThreshold<any, any>).invertExtent;
