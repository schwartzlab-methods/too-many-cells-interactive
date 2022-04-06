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
