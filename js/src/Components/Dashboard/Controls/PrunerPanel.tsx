import { median, min, quantile, range, ticks } from 'd3-array';
import { HierarchyNode } from 'd3-hierarchy';
import React, {
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';
import { TMCNode } from '../../../types';
import { buildTree, getMAD, pruneTreeByMinValue } from '../../../util';
import { TreeContext } from '../Dashboard';
import Button from '../../Button';
import AreaChartComponent from '../AreaChartComponent';
import { max } from 'lodash';

interface PrunerPanelProps {}

type Pruner = 'depth' | 'distance' | 'distanceSearch' | 'size';

const initialPrunerVal: Record<Pruner, number> = {
    depth: 0,
    distance: 0,
    distanceSearch: 0,
    size: 0,
};

const PrunerPanel: React.FC<PrunerPanelProps> = ({}) => {
    const [prunerVals, setPrunerVals] =
        useState<Record<Pruner, number>>(initialPrunerVal);

    const [expanded, setExpanded] = useState<Pruner>();

    const treeContext = useContext(TreeContext);

    /* prune by size values */
    const sizeGroupsPlain = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return getSizeGroups(treeContext.rootPositionedTree!);
        } else return new Map();
    }, [treeContext.rootPositionedTree]);

    const sizeGroupsMad = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return getSizeMadGroups(treeContext.rootPositionedTree!);
        } else return new Map();
    }, [treeContext.rootPositionedTree]);

    const sizeMadValue = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return getMAD(
                treeContext.rootPositionedTree
                    .descendants()
                    .map(v => v.data.distance!)
                    .filter(Boolean)
            )!;
        } else return 0;
    }, [treeContext.rootPositionedTree]);

    const sizeMedian = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return quantile(
                treeContext.rootPositionedTree
                    .descendants()
                    .map(v => v.value!)
                    .filter(Boolean),
                0.5
            )!;
        } else return 0;
    }, [treeContext.rootPositionedTree]);

    /* prune by distance values */
    const distanceGroupsPlain = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return getDistanceGroups(
                treeContext.rootPositionedTree!,
                pruneTreeByMinDistance
            );
        } else return new Map();
    }, [treeContext.rootPositionedTree]);

    const distanceGroupsMad = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return getDistanceMadGroups(
                treeContext.rootPositionedTree!,
                pruneTreeByMinDistance
            );
        } else return new Map();
    }, [treeContext.rootPositionedTree]);

    const distanceSearchGroupsMad = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return getDistanceMadGroups(
                treeContext.rootPositionedTree!,
                pruneTreeByMinDistanceSearch
            );
        } else return new Map();
    }, [treeContext.rootPositionedTree]);

    const distanceSearchGroupsPlain = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return getDistanceGroups(
                treeContext.rootPositionedTree!,
                pruneTreeByMinDistanceSearch
            );
        } else return new Map();
    }, [treeContext.rootPositionedTree]);

    const distanceMadValue = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return getMAD(
                treeContext.rootPositionedTree
                    .descendants()
                    .map(v => v.data.distance!)
                    .filter(Boolean)
            )!;
        } else return 0;
    }, [treeContext.rootPositionedTree]);

    const distanceMedian = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return quantile(
                treeContext.rootPositionedTree
                    .descendants()
                    .map(v => v.data.distance!)
                    .filter(Boolean),
                0.5
            )!;
        } else return 0;
    }, [treeContext.rootPositionedTree]);

    /* prune by depth props */

    const depthSearchGroupsPlain = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return getDepthGroups(treeContext.rootPositionedTree!);
        } else return new Map();
    }, [treeContext.rootPositionedTree]);

    //just need the steps

    const onExpand = (id: Pruner) => () => {
        updatePrunerVal(id)(0);
        setExpanded(id);
    };

    /* todo: the following three could be collapsed by just passing in callback */
    const updateDepth = useCallback(
        (depth: number) => {
            const pruned = pruneTreeByDepth(
                treeContext.rootPositionedTree!,
                depth
            );

            const visibleNodes = buildTree(pruned, treeContext.w!);

            treeContext.setTreeContext!({
                ...treeContext,
                visibleNodes,
            });
        },
        [treeContext]
    );

    const updateMinNodeSize = useCallback(
        (size: number) => {
            const pruned = pruneTreeByMinValue(
                treeContext.rootPositionedTree!,
                size
            );

            const visibleNodes = buildTree(pruned, treeContext.w!);

            treeContext.setTreeContext!({
                ...treeContext,
                visibleNodes,
            });
        },
        [treeContext]
    );

    const updateMinDistance = useCallback(
        (search = false) =>
            (distance: number) => {
                const pruned = search
                    ? pruneTreeByMinDistanceSearch(
                          treeContext.rootPositionedTree!,
                          distance
                      )
                    : pruneTreeByMinDistance(
                          treeContext.rootPositionedTree!,
                          distance
                      );

                const visibleNodes = buildTree(pruned, treeContext.w!);

                treeContext.setTreeContext!({
                    ...treeContext,
                    visibleNodes,
                });
            },
        [treeContext]
    );

    const updatePrunerVal = (pruner: Pruner) => (val: number) =>
        setPrunerVals({ ...initialPrunerVal, [pruner]: val });

    return (
        <div>
            <SmartPruner
                expanded={expanded === 'size'}
                id="size"
                label="Prune by size"
                madValues={sizeGroupsMad}
                madSize={sizeMadValue}
                median={sizeMedian}
                onChange={updatePrunerVal('size')}
                onExpand={onExpand('size')}
                onSubmit={updateMinNodeSize}
                plainValues={sizeGroupsPlain}
                value={prunerVals.size}
            />
            <SmartPruner
                expanded={expanded === 'distance'}
                id="distance"
                label="Prune by distance"
                madValues={distanceGroupsMad}
                madSize={distanceMadValue}
                median={distanceMedian}
                onChange={updatePrunerVal('distance')}
                onExpand={onExpand('distance')}
                onSubmit={updateMinDistance()}
                plainValues={distanceGroupsPlain}
                value={prunerVals.distance}
            />
            <SmartPruner
                expanded={expanded === 'distanceSearch'}
                id="distanceSearch"
                label="Prune by distance (search)"
                madValues={distanceSearchGroupsMad}
                madSize={distanceMadValue}
                median={distanceMedian}
                onChange={updatePrunerVal('distanceSearch')}
                onExpand={onExpand('distanceSearch')}
                onSubmit={updateMinDistance(true)}
                plainValues={distanceSearchGroupsPlain}
                value={prunerVals.distanceSearch}
            />
            <Pruner
                expanded={expanded === 'depth'}
                label="Depth"
                onExpand={onExpand('depth')}
                onChange={updatePrunerVal('depth')}
                onSubmit={updateDepth}
                plainValues={depthSearchGroupsPlain}
                value={prunerVals.depth}
            />
        </div>
    );
};

export default PrunerPanel;

interface PrunerProps {
    expanded: boolean;
    label: string;
    onExpand: () => void;
    onChange: (val: number) => void;
    onSubmit: (size: number) => void;
    plainValues: Map<number, number>;
    value: number;
}

const Pruner: React.FC<PrunerProps> = ({
    expanded,
    label,
    onExpand,
    plainValues,
    onChange,
    onSubmit,
    value,
}) => {
    return (
        <div>
            <span onClick={onExpand}>
                <Label>{label}</Label>
            </span>
            {expanded && (
                <>
                    <AreaChartComponent
                        onBrush={onSubmit}
                        counts={plainValues}
                        title="Drag to Prune"
                    />
                    <Input
                        onChange={v => onChange(+v.currentTarget.value)}
                        value={value}
                    />
                    <Button onClick={() => onSubmit(value)}>Submit</Button>
                </>
            )}
        </div>
    );
};

interface SmartPrunerProps {
    expanded: boolean;
    id: Pruner;
    label: string;
    madSize: number;
    madValues: Map<number, number>;
    median: number;
    onExpand: () => void;
    plainValues: Map<number, number>;
    onChange: (val: number) => void;
    onSubmit: (size: number) => void;
    value: number;
}

const SmartPruner: React.FC<SmartPrunerProps> = ({
    expanded,
    id,
    label,
    madValues,
    median,
    onExpand,
    plainValues,
    onChange,
    onSubmit,
    value,
}) => {
    const [type, setType] = useState<'raw' | 'smart'>('raw');

    const handleChange = (type: 'raw' | 'smart') => {
        // reset parent cutoff
        onChange(0);
        setType(type);
    };

    return (
        <div>
            <span onClick={onExpand}>
                <Label>{label}</Label>
            </span>
            {expanded && (
                <span>
                    <RadioGroup>
                        <RadioButton
                            checked={type === 'raw'}
                            id={`${id}raw`}
                            name={`${id}types`}
                            onChange={() => handleChange('raw')}
                            type="radio"
                        />
                        <RadioLabel htmlFor={`${id}raw`}>Raw</RadioLabel>
                        <RadioButton
                            checked={type === 'smart'}
                            id={`${id}smart`}
                            name={`${id}types`}
                            onChange={() => handleChange('smart')}
                            type="radio"
                        />
                        <RadioLabel htmlFor={`${id}smart`}>Smart</RadioLabel>
                    </RadioGroup>
                    {type === 'raw' && (
                        <AreaChartComponent
                            onBrush={onSubmit}
                            counts={plainValues}
                            title="Drag to Prune"
                        />
                    )}
                    {type === 'smart' && (
                        <AreaChartComponent
                            onBrush={val => {
                                onSubmit(median + val * median);
                            }}
                            counts={madValues}
                            title="Drag to Prune"
                        />
                    )}
                    <Input
                        onChange={v => onChange(+v.currentTarget.value)}
                        value={value}
                    />
                    <Button onClick={() => onSubmit(value)}>Submit</Button>
                </span>
            )}
        </div>
    );
};

/* todo: we probably want Arial as global font */
const Label = styled.p`
    cursor: pointer;
    font-family: Arial;
    margin: 0.25em 0.25em;
`;

const Input = styled.input`
    &:focus,
    &:focus-visible {
        border-color: ${props => props.theme.palette.lightGrey};
        outline: none;
    }
    background-color: ${props => props.theme.palette.white};
    border: 0.1em solid ${props => props.theme.palette.primary};
    color: ${props => props.theme.palette.grey};
    margin: 2;
    padding: 0.25em 0.5em;
    width: 200px;
`;

const RadioButton = styled.input``;
const RadioGroup = styled.div``;
const RadioLabel = styled.label`
    cursor: pointer;
`;

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree
 * This ends up being the smallest child of the root
 */
const getMaxCutoffNodeSize = (tree: HierarchyNode<TMCNode>) => {
    if (tree.children) {
        return min(tree.children.map(d => d.value || 0));
    } else return 0;
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` <= n in tree
 */
const getSizeGroups = (tree: HierarchyNode<TMCNode>, binCount = 50) => {
    const maxSize = getMaxCutoffNodeSize(tree)!;

    const bounds = ticks(0, maxSize, binCount);

    return bounds.reduce(
        (acc, curr) =>
            acc.set(curr, pruneTreeByMinValue(tree, curr).descendants().length),
        new Map<number, number>()
    );
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` >= median + (n * MAD) in tree
 */
const getSizeMadGroups = (tree: HierarchyNode<TMCNode>) => {
    const maxSize = getMaxCutoffNodeSize(tree)!;

    const values = tree
        .descendants()
        .map(d => d.value!)
        .sort((a, b) => (a < b ? -1 : 1));

    const mad = getMAD(values)!;
    const med = median(values)!;

    const maxMads = Math.ceil((maxSize - med) / mad);

    const bounds = range(0, maxMads).map(m => ({
        size: med + m * mad,
        mads: m,
    }));

    return bounds.reduce(
        (acc, curr) =>
            acc.set(
                curr.mads,
                pruneTreeByMinValue(tree, curr.size).descendants().length
            ),
        new Map<number, number>()
    );
};

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree
 * This ends up being the smallest grandchild of the root
 */
const getMaxCutoffDistance = (tree: HierarchyNode<TMCNode>) => {
    if (tree.children) {
        return min(
            tree.children.flatMap(d =>
                d.children ? d.children.map(d => d.data.distance || 0) : 0
            )
        );
    } else return 0;
};

const pruneTreeByMinDistance = (
    tree: HierarchyNode<TMCNode>,
    distance: number
) =>
    tree.copy().eachBefore(d => {
        if (!d.data.distance || d.data.distance < distance) {
            //keep the node, even though it's under the threshold, but eliminate the children
            d.children = undefined;
        }
    });

/* 
    hmm this is the same as above, and why shouldn't it be? unless we want it to stop at first cut  
    todo: look at docs, we may want to cut the node and children?
*/
const pruneTreeByMinDistanceSearch = (
    tree: HierarchyNode<TMCNode>,
    distance: number
) =>
    tree.copy().eachAfter(d => {
        if (!d.data.distance || d.data.distance < distance) {
            //keep the node, even though it's under the threshold, but eliminate the children
            d.children = undefined;
        }
    });

/* 

*/
const pruneTreeByDepth = (tree: HierarchyNode<TMCNode>, depth: number) =>
    tree.copy().eachAfter(d => {
        if (d.depth > depth && d.parent) {
            d.parent!.children = undefined;
        }
    });

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` <= n in tree
 */
const getDistanceGroups = (
    tree: HierarchyNode<TMCNode>,
    pruneFn: (
        tree: HierarchyNode<TMCNode>,
        size: number
    ) => HierarchyNode<TMCNode>,
    binCount = 50
) => {
    const maxSize = getMaxCutoffDistance(tree)!;

    const bounds = ticks(0, maxSize, binCount);

    return bounds.reduce(
        (acc, curr) => acc.set(curr, pruneFn(tree, curr).descendants().length),
        new Map<number, number>()
    );
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `distance` >= median + (n * MAD) in tree
 */
const getDistanceMadGroups = (
    tree: HierarchyNode<TMCNode>,
    pruneFn: (
        tree: HierarchyNode<TMCNode>,
        size: number
    ) => HierarchyNode<TMCNode>
) => {
    const maxSize = getMaxCutoffDistance(tree)!;

    const values = tree
        .descendants()
        .map(d => d.data.distance!)
        .sort((a, b) => (a < b ? -1 : 1));

    const mad = getMAD(values)!;
    const med = median(values)!;

    const maxMads = Math.ceil((maxSize - med) / mad);

    const bounds = range(0, maxMads).map(m => ({
        size: med + m * mad,
        mads: m,
    }));

    return bounds.reduce(
        (acc, curr) =>
            acc.set(curr.mads, pruneFn(tree, curr.size).descendants().length),
        new Map<number, number>()
    );
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `depth` <= n
 */
const getDepthGroups = (tree: HierarchyNode<TMCNode>) => {
    const maxSize = max(tree.descendants().map(n => n.depth))!;

    return range(0, maxSize + 1)
        .reverse()
        .reduce(
            (acc, curr) =>
                acc.set(
                    curr,
                    tree.descendants().filter(d => d.depth <= curr).length
                ),
            new Map<number, number>()
        );
};
