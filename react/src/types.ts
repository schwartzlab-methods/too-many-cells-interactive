import {
    HierarchyNode,
    HierarchyPointLink,
    HierarchyPointNode,
} from 'd3-hierarchy';
import { ScaleOrdinal, ScaleSequential } from 'd3-scale';

export interface RoseNodeItem {
    _barcode: { unCell: string };
    _cellRow: { unRow: number };
}

/* 
    _featureValues here is raw count for cell, which must persist on object for further processing
    node.featureHiLos contains calculated display values that may change according to user interaction
*/
export interface TMCNodeItem extends RoseNodeItem {
    _barcode: {
        unCell: string;
        _featureValues: Record<string, number | undefined>;
    };
}

export interface RoseNodeObj {
    _item: RoseNodeItem[] | null;
    _distance: number | null;
    _significance: number | null;
}

export type EmptyRoseNode = [RoseNodeObj, []];

export type RoseNode = [RoseNodeObj, RoseNode[] | []] | [];

export interface AttributeMapValue {
    quantity: number;
    scaleKey: string | number;
}

export type AttributeMap = Record<string | number, AttributeMapValue>;

export interface TMCFlatNode {
    distance: number | null;
    id: string;
    featureAverage: AttributeMap;
    featureCount: AttributeMap;
    featureHiLos: AttributeMap;
    items: TMCNodeItem[] | null;
    labelCount?: AttributeMap;
    parentId: string | undefined;
    significance: number | null;
    userAnnotation: AttributeMap;
}

export interface TMCNode extends TMCFlatNode {
    labelCount: AttributeMap;
    originalNodeId: number;
    prunedNodeId: number;
}

export const isLinkNode = (
    item: TMCHiearchyNode | TMCHiearchyLink
): item is TMCHiearchyLink => !!(item as TMCHiearchyLink).source;

export const scaleIsSequential = (
    scale: ScaleOrdinal<string, string> | ScaleSequential<string>
): scale is ScaleSequential<string> =>
    !!(scale as ScaleSequential<string>).interpolator;

/* Tree without layout calculated (i.e., no x or y values attached) */
export type TMCHiearchyNode = HierarchyNode<TMCNode>;
/* Tree with layout calcaulated */
export type TMCHierarchyPointNode = HierarchyPointNode<TMCNode>;
/* Basic tree whose use has to do with data and doesn't depend on having coordinates set */
export type TMCHierarchyDataNode = TMCHierarchyPointNode | TMCHiearchyNode;
export type TMCHiearchyLink = HierarchyPointLink<TMCNode>;

export type FeatureMap = Record<string, Record<string, number>>;

export interface PlainOrMADVal {
    plainValue: number;
    madsValue?: number;
}

export type ValueDisplayUnits = 'plain' | 'mads';
