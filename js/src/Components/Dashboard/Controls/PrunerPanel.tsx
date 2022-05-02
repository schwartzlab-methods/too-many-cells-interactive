import React, { useCallback, useContext, useMemo, useState } from 'react';
import { median, min, quantile, range, ticks } from 'd3-array';
import { format } from 'd3-format';
import { HierarchyNode } from 'd3-hierarchy';
import styled from 'styled-components';
import { max } from 'lodash';
import { TMCNode } from '../../../types';
import {
    getMAD,
    pruneTreeByMinDistance,
    pruneTreeByMinDistanceSearch,
    pruneTreeByMinValue,
} from '../../../util';
import { TreeContext, ValuePruneType } from '../Dashboard';
import {
    AreaChartComponent,
    CaretDownIcon,
    CaretUpIcon,
} from '../../../Components';
//https://github.com/styled-components/styled-components/issues/1449
import Button from '../../Button';
import { NumberInput } from '../../Input';
import { Label } from '../../Typography';

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

const PrunerPanel: React.FC = () => {
    /* we need to sync local state across these handlers, so we set it here */
    const [prunerVal, setPrunerVal] = useState<number | string>(0);

    const [expanded, setExpanded] = useState<ValuePruneType>();

    const { rootPositionedTree, setPruneContext } = useContext(TreeContext);

    const setValuePruner = useCallback(
        (key: ValuePruneType, value: number) => {
            return setPruneContext({
                valuePruner: {
                    key,
                    value,
                },
            });
        },
        [setPruneContext]
    );

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

    const onExpand = (id: ValuePruneType) => () => {
        setExpanded(expanded === id ? undefined : id);
        updatePrunerVal(0);
    };

    const pruneByContext = (contextKey: ValuePruneType) => (val: number) => {
        return setValuePruner(contextKey, val);
    };

    const updatePrunerVal = (val: number | string) => setPrunerVal(val);

    return (
        <PrunerPanelContainer>
            <SmartPruner
                expanded={expanded === 'minSize'}
                id="minSize"
                label="Prune by size"
                madValues={sizeGroupsMad}
                madSize={sizeMadValue}
                median={sizeMedian}
                onChange={updatePrunerVal}
                onExpand={onExpand('minSize')}
                onSubmit={pruneByContext('minSize')}
                plainValues={sizeGroupsPlain}
                value={prunerVal}
                xLabel="Size"
            />
            <SmartPruner
                expanded={expanded === 'minDistance'}
                id="minDistance"
                label="Prune by distance"
                madValues={distanceGroupsMad}
                madSize={distanceMadValue}
                median={distanceMedian}
                onChange={updatePrunerVal}
                onExpand={onExpand('minDistance')}
                onSubmit={pruneByContext('minDistance')}
                plainValues={distanceGroupsPlain}
                value={prunerVal}
                xLabel="Distance"
            />
            <SmartPruner
                expanded={expanded === 'minDistanceSearch'}
                id="minDistanceSearch"
                label="Prune by distance (search)"
                madValues={distanceSearchGroupsMad}
                madSize={distanceMadValue}
                median={distanceMedian}
                onChange={updatePrunerVal}
                onExpand={onExpand('minDistanceSearch')}
                onSubmit={pruneByContext('minDistanceSearch')}
                plainValues={distanceSearchGroupsPlain}
                value={prunerVal}
                xLabel="Distance (Search)"
            />
            <Pruner
                expanded={expanded === 'minDepth'}
                label="Prune by depth"
                onExpand={onExpand('minDepth')}
                onChange={updatePrunerVal}
                onSubmit={pruneByContext('minDepth')}
                plainValues={depthSearchGroupsPlain}
                xLabel="Depth"
                value={prunerVal}
            />
            <SubmitButton
                onClick={() => {
                    setPrunerVal(0);
                    setExpanded(undefined);

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
    value: number | string;
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
                            onSubmit={() => onSubmit(+value)}
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
    id: ValuePruneType;
    label: string;
    madSize: number;
    madValues: Map<number, number>;
    median: number;
    onExpand: () => void;
    plainValues: Map<number, number>;
    onChange: (val: number | string) => void;
    onSubmit: (size: number) => void;
    xLabel: string;
    value: number | string;
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
                            onSubmit={() => onSubmit(+value)}
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
    onSubmit: (val: number | string) => void;
    value: number | string;
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
