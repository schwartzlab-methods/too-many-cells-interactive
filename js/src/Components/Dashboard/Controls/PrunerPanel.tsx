import { median, min, quantile, range, ticks } from 'd3-array';
import { HierarchyNode } from 'd3-hierarchy';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import styled from 'styled-components';
import { TMCNode } from '../../../types';
import { max } from 'lodash';
import {
    calculateTreeLayout,
    getMAD,
    pruneTreeByMinValue,
} from '../../../util';
import { TreeContext } from '../Dashboard';
import {
    AreaChartComponent,
    CaretDownIcon,
    CaretUpIcon,
} from './../../../Components';
//https://github.com/styled-components/styled-components/issues/1449
import Button from '../../Button';
import { NumberInput } from '../../Input';
import { Label } from '../../Typography';
import { format } from 'd3-format';

const ChartContainer = styled.div<{ expanded: boolean }>`
    opacity: ${props => (props.expanded ? 1 : 0)};
    transition: 0.5s opacity cubic-bezier(0.73, 0.32, 0.34, 1.5);
`;

const PrunerContainer = styled.div<{ expanded: boolean }>`
    cursor: pointer;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    max-width: 300px;
    height: ${props => (props.expanded ? '220px' : '25px')};
    + {PrunerContainer} {
        margin-bottom: 10px;
    }
    transition: 0.25s height cubic-bezier(.73,.32,.34,1.5)
`;

const PrunerLabelContainer = styled.div`
    display: flex;
    flex-direction: columns;
    justify-content: space-between;
`;

const PrunerPanelContainer = styled.div`
    align-self: flex-start;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    justify-content: flex-start;
`;

const RadioButton = styled.input.attrs({ type: 'radio' })`
    margin: 0px;
    margin-right: 3px;
`;
const RadioGroup = styled.div`
    align-items: center;
    display: flex;
    margin-top: 5px;
`;

const RadioLabel = styled(Label)`
    margin-left: 3px;
    cursor: pointer;
    font-size: 12px;
    + input[type='radio'] {
        margin-left: 3px;
    }
`;

const SubmitButton = styled(Button)`
    align-self: flex-start;
    margin-left: 5px;
`;

const TextInputGroup = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
`;

type Pruner = 'depth' | 'distance' | 'distanceSearch' | 'size';

const initialPrunerVal: Record<Pruner, number> = {
    depth: 0,
    distance: 0,
    distanceSearch: 0,
    size: 0,
};

const PrunerPanel: React.FC = () => {
    const [prunerVals, setPrunerVals] =
        useState<Record<Pruner, number>>(initialPrunerVal);

    const [expanded, setExpanded] = useState<Pruner>();

    const { displayContext, rootPositionedTree, setDisplayContext } =
        useContext(TreeContext);

    const sizeGroupsPlain = useMemo(() => {
        if (rootPositionedTree) {
            return getSizeGroups(rootPositionedTree!);
        } else return new Map();
    }, [rootPositionedTree]);

    const sizeGroupsMad = useMemo(() => {
        if (rootPositionedTree) {
            return getSizeMadGroups(rootPositionedTree!);
        } else return new Map();
    }, [rootPositionedTree]);

    const sizeMadValue = useMemo(() => {
        if (rootPositionedTree) {
            return getMAD(
                rootPositionedTree
                    .descendants()
                    .map(v => v.data.distance!)
                    .filter(Boolean)
            )!;
        } else return 0;
    }, [rootPositionedTree]);

    const sizeMedian = useMemo(() => {
        if (rootPositionedTree) {
            return quantile(
                rootPositionedTree
                    .descendants()
                    .map(v => v.value!)
                    .filter(Boolean),
                0.5
            )!;
        } else return 0;
    }, [rootPositionedTree]);

    const distanceGroupsPlain = useMemo(() => {
        if (rootPositionedTree) {
            return getDistanceGroups(
                rootPositionedTree!,
                getMaxCutoffDistance(rootPositionedTree!),
                pruneTreeByMinDistance
            );
        } else return new Map();
    }, [rootPositionedTree]);

    const distanceGroupsMad = useMemo(() => {
        if (rootPositionedTree) {
            return getDistanceMadGroups(
                rootPositionedTree!,
                getMaxCutoffDistance(rootPositionedTree!),
                pruneTreeByMinDistance
            );
        } else return new Map();
    }, [rootPositionedTree]);

    const distanceSearchGroupsMad = useMemo(() => {
        if (rootPositionedTree) {
            return getDistanceMadGroups(
                rootPositionedTree!,
                getMaxCutoffDistanceSearch(rootPositionedTree!),
                pruneTreeByMinDistanceSearch
            );
        } else return new Map();
    }, [rootPositionedTree]);

    const distanceSearchGroupsPlain = useMemo(() => {
        if (rootPositionedTree) {
            return getDistanceGroups(
                rootPositionedTree!,
                getMaxCutoffDistanceSearch(rootPositionedTree!),
                pruneTreeByMinDistanceSearch
            );
        } else return new Map();
    }, [rootPositionedTree]);

    const distanceMadValue = useMemo(() => {
        if (rootPositionedTree) {
            return getMAD(
                rootPositionedTree
                    .descendants()
                    .map(v => v.data.distance!)
                    .filter(Boolean)
            )!;
        } else return 0;
    }, [rootPositionedTree]);

    const distanceMedian = useMemo(() => {
        if (rootPositionedTree) {
            return quantile(
                rootPositionedTree
                    .descendants()
                    .map(v => v.data.distance!)
                    .filter(Boolean),
                0.5
            )!;
        } else return 0;
    }, [rootPositionedTree]);

    const depthSearchGroupsPlain = useMemo(() => {
        if (rootPositionedTree) {
            return getDepthGroups(rootPositionedTree!);
        } else return new Map();
    }, [rootPositionedTree]);

    const onExpand = (id: Pruner) => () => {
        updatePrunerVal(id)(0);
        setExpanded(expanded === id ? undefined : id);
    };

    const prune = useCallback(
        (
                cb: (
                    tree: HierarchyNode<TMCNode>,
                    pruneVal: number
                ) => HierarchyNode<TMCNode>
            ) =>
            (distance: number) => {
                const pruned = cb(rootPositionedTree!, distance);

                const visibleNodes = calculateTreeLayout(
                    pruned,
                    displayContext.w!
                );

                /* setDisplayContext({
                    visibleNodes,
                }); */
            },
        [displayContext]
    );

    const updatePrunerVal = (pruner: Pruner) => (val: number | string) =>
        setPrunerVals({ ...initialPrunerVal, [pruner]: val });

    return (
        <PrunerPanelContainer>
            <SmartPruner
                expanded={expanded === 'size'}
                id="size"
                label="Prune by size"
                madValues={sizeGroupsMad}
                madSize={sizeMadValue}
                median={sizeMedian}
                onChange={updatePrunerVal('size')}
                onExpand={onExpand('size')}
                onSubmit={prune(pruneTreeByMinValue)}
                plainValues={sizeGroupsPlain}
                value={prunerVals.size}
                xLabel="Size"
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
                onSubmit={prune(pruneTreeByMinDistance)}
                plainValues={distanceGroupsPlain}
                value={prunerVals.distance}
                xLabel="Distance"
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
                onSubmit={prune(pruneTreeByMinDistanceSearch)}
                plainValues={distanceSearchGroupsPlain}
                value={prunerVals.distanceSearch}
                xLabel="Distance (Search)"
            />
            <Pruner
                expanded={expanded === 'depth'}
                label="Prune by depth"
                onExpand={onExpand('depth')}
                onChange={updatePrunerVal('depth')}
                onSubmit={prune(pruneTreeByDepth)}
                plainValues={depthSearchGroupsPlain}
                xLabel="Depth"
                value={prunerVals.depth}
            />
            <SubmitButton
                onClick={() => {
                    setPrunerVals(initialPrunerVal);
                    setExpanded(undefined);
                    const visibleNodes = calculateTreeLayout(
                        rootPositionedTree!,
                        displayContext.w!
                    );

                    /* setDisplayContext({
                        visibleNodes,
                    }); */
                }}
            >
                Reset
            </SubmitButton>
        </PrunerPanelContainer>
    );
};

export default PrunerPanel;

interface PrunerProps {
    expanded: boolean;
    label: string;
    onExpand: () => void;
    onChange: (val: number | string) => void;
    onSubmit: (size: number) => void;
    plainValues: Map<number, number>;
    xLabel: string;
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
    xLabel,
}) => {
    return (
        <PrunerContainer expanded={expanded}>
            <PrunerLabel expanded={expanded} onClick={onExpand}>
                {label}
            </PrunerLabel>
            <ChartContainer expanded={expanded}>
                {expanded && (
                    <>
                        <AreaChartComponent
                            onBrush={v => {
                                onChange(+format('.3f')(v));
                                onSubmit(v);
                            }}
                            counts={plainValues}
                            xLabel={xLabel}
                        />
                        <UpdateBox
                            onChange={v => onChange(v)}
                            onSubmit={() => onSubmit(value)}
                            value={value}
                        />
                    </>
                )}
            </ChartContainer>
        </PrunerContainer>
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
    onChange: (val: number | string) => void;
    onSubmit: (size: number) => void;
    xLabel: string;
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
    xLabel,
    value,
}) => {
    const [type, setType] = useState<'raw' | 'smart'>('raw');

    const handleChange = (type: 'raw' | 'smart') => {
        // reset parent cutoff
        onChange(0);
        setType(type);
    };

    return (
        <PrunerContainer expanded={expanded}>
            <PrunerLabel expanded={expanded} onClick={onExpand}>
                {label}
            </PrunerLabel>
            <ChartContainer expanded={expanded}>
                {expanded && (
                    <>
                        <RadioGroup>
                            <RadioButton
                                checked={type === 'raw'}
                                id={`${id}raw`}
                                name={`${id}types`}
                                onChange={() => handleChange('raw')}
                                type="radio"
                            />
                            <RadioLabel htmlFor={`${id}raw`}>Plain</RadioLabel>
                            <RadioButton
                                checked={type === 'smart'}
                                id={`${id}smart`}
                                name={`${id}types`}
                                onChange={() => handleChange('smart')}
                                type="radio"
                            />
                            <RadioLabel htmlFor={`${id}smart`}>
                                Smart
                            </RadioLabel>
                        </RadioGroup>
                        {type === 'raw' && (
                            <AreaChartComponent
                                onBrush={val => {
                                    onChange(+format('.3f')(val));
                                    onSubmit(val);
                                }}
                                counts={plainValues}
                                xLabel={xLabel}
                            />
                        )}
                        {type === 'smart' && (
                            <AreaChartComponent
                                onBrush={val => {
                                    onChange(+format('.3f')(val));
                                    onSubmit(median + val * median);
                                }}
                                counts={madValues}
                                xLabel={`${xLabel} in MADs from median`}
                            />
                        )}
                        <UpdateBox
                            onChange={v => onChange(v)}
                            onSubmit={() => onSubmit(value)}
                            value={value}
                        />
                    </>
                )}
            </ChartContainer>
        </PrunerContainer>
    );
};

const PrunerLabel: React.FC<{ expanded: boolean; onClick: () => void }> = ({
    children,
    expanded,
    onClick,
}) => (
    <PrunerLabelContainer onClick={onClick}>
        {children}
        {expanded ? <CaretDownIcon /> : <CaretUpIcon />}
    </PrunerLabelContainer>
);

interface UpdateBoxProps {
    onChange: (val: number | string) => void;
    onSubmit: (val: number) => void;
    value: number;
}

const UpdateBox: React.FC<UpdateBoxProps> = ({ onChange, onSubmit, value }) => {
    return (
        <TextInputGroup
            onKeyUp={e => {
                if (e.code === 'Enter') {
                    onSubmit(value);
                }
            }}
        >
            <NumberInput onChange={v => onChange(v)} value={value} />
            <SubmitButton onClick={() => onSubmit(value)}>Update</SubmitButton>
        </TextInputGroup>
    );
};

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
        )!;
    } else return 0;
};

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree
 * This ends up being the smallest child of the root
 */
const getMaxCutoffDistanceSearch = (tree: HierarchyNode<TMCNode>) => {
    if (tree.children) {
        return min(tree.children.map(d => d.data.distance || 0))!;
    } else return 0;
};

/**
 * Stopping criteria to stop at the node immediate after a node with DOUBLE distance.
 * So a node N with L and R children will stop with this criteria the distance at N to L and R is < DOUBLE.
 * Includes L and R in the final result."
 *
 * https://github.com/GregorySchwartz/too-many-cells/blob/master/src/TooManyCells/Program/Options.hs#L43
 */
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
    Similar to --min-distance, but searches from the leaves to the root -- if a path from a subtree contains a distance of at least DOUBLE, 
    keep that path, otherwise prune it. This argument assists in finding distant nodes."
    https://github.com/GregorySchwartz/too-many-cells/blob/master/src/TooManyCells/Program/Options.hs#L44
    */
const pruneTreeByMinDistanceSearch = (
    tree: HierarchyNode<TMCNode>,
    distance: number
) =>
    tree.copy().eachAfter(d => {
        if (!d.data.distance || d.data.distance < distance) {
            if (d.parent) {
                d.parent.children = undefined;
            }
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
    cutoffDistance: number,
    pruneFn: (
        tree: HierarchyNode<TMCNode>,
        size: number
    ) => HierarchyNode<TMCNode>,
    binCount = 50
) => {
    const bounds = ticks(0, cutoffDistance, binCount);

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
    cutoffDistance: number,
    pruneFn: (
        tree: HierarchyNode<TMCNode>,
        size: number
    ) => HierarchyNode<TMCNode>
) => {
    const values = tree
        .descendants()
        .map(d => d.data.distance!)
        .sort((a, b) => (a < b ? -1 : 1));

    const mad = getMAD(values)!;
    const med = median(values)!;

    const maxMads = Math.ceil((cutoffDistance - med) / mad);

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
