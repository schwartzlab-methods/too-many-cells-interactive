import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
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
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';
import { Column, Row } from '../../Layout';

const ChartContainer = styled.div<{ expanded: boolean }>`
    opacity: ${props => (props.expanded ? 1 : 0)};
    transition: 0.5s opacity cubic-bezier(0.73, 0.32, 0.34, 1.5);
`;

const PrunerContainer = styled.div<{ expanded: boolean }>`
    cursor: pointer;
    display: flex;
    flex-direction: column;
    height: ${props => (props.expanded ? '255px' : '25px')};
    + {PrunerContainer} {
        margin-bottom: 10px;
    }
    transition: 0.25s height cubic-bezier(.73,.32,.34,1.5);
    width: 320px;
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
    const [expanded, setExpanded] = useState<ValuePruneType>();

    const {
        displayContext: { rootPositionedTree },
        pruneContext,
        setPruneContext,
    } = useContext(TreeContext);

    const currentValuePruner = useMemo(() => {
        return pruneContext.slice(-1)[0].valuePruner;
    }, [pruneContext]);

    const setValuePruner = useCallback(
        (key: ValuePruneType, value: number) => {
            return setPruneContext({
                valuePruner: {
                    key,
                    value,
                },
                clickPruneHistory: [],
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

    const getPrunerVal = (key: ValuePruneType) =>
        key === currentValuePruner.key ? currentValuePruner.value : undefined;

    const onExpand = (id: ValuePruneType) => () => {
        setExpanded(expanded === id ? undefined : id);
    };

    const pruneByContext = (contextKey: ValuePruneType) => (val: number) => {
        return setValuePruner(contextKey, val);
    };

    return (
        <Column>
            <SmartPruner
                expanded={expanded === 'minSize'}
                id="minSize"
                label="Prune by size"
                madValues={sizeGroupsMad}
                madSize={sizeMadValue}
                median={sizeMedian}
                onExpand={onExpand('minSize')}
                onSubmit={pruneByContext('minSize')}
                plainValues={sizeGroupsPlain}
                value={getPrunerVal('minSize')}
                xLabel="Size"
            />
            <SmartPruner
                expanded={expanded === 'minDistance'}
                id="minDistance"
                label="Prune by distance"
                madValues={distanceGroupsMad}
                madSize={distanceMadValue}
                median={distanceMedian}
                onExpand={onExpand('minDistance')}
                onSubmit={pruneByContext('minDistance')}
                plainValues={distanceGroupsPlain}
                value={getPrunerVal('minDistance')}
                xLabel="Distance"
            />
            <SmartPruner
                expanded={expanded === 'minDistanceSearch'}
                id="minDistanceSearch"
                label="Prune by distance (search)"
                madValues={distanceSearchGroupsMad}
                madSize={distanceMadValue}
                median={distanceMedian}
                onExpand={onExpand('minDistanceSearch')}
                onSubmit={pruneByContext('minDistanceSearch')}
                plainValues={distanceSearchGroupsPlain}
                value={getPrunerVal('minDistanceSearch')}
                xLabel="Distance (Search)"
            />
            <Pruner
                expanded={expanded === 'minDepth'}
                label="Prune by depth"
                onExpand={onExpand('minDepth')}
                onSubmit={pruneByContext('minDepth')}
                plainValues={depthSearchGroupsPlain}
                xLabel="Depth"
                value={getPrunerVal('minDepth')}
            />
        </Column>
    );
};

export default PrunerPanel;

interface PrunerProps {
    expanded: boolean;
    label: string;
    onExpand: () => void;
    onSubmit: (size: number) => void;
    plainValues: Map<number, number>;
    xLabel: string;
    value?: number;
}

const Pruner: React.FC<PrunerProps> = ({
    expanded,
    label,
    onExpand,
    plainValues,
    onSubmit,
    value,
    xLabel,
}) => {
    const [inputVal, setInputVal] = useState<string>(value ? value + '' : '0');

    useEffect(() => {
        if (!value && inputVal != '0') {
            setInputVal('0');
        }
    }, [value]);

    return (
        <PrunerContainer expanded={expanded}>
            <PrunerLabel expanded={expanded} onClick={onExpand}>
                {label}
            </PrunerLabel>
            <ChartContainer expanded={expanded}>
                {expanded && (
                    <>
                        <AreaChartComponent
                            counts={plainValues}
                            onBrush={v => {
                                setInputVal(format('.1f')(v));
                                onSubmit(v);
                            }}
                            value={value}
                            xLabel={xLabel}
                        />
                        <UpdateBox
                            onChange={v => setInputVal(v + '')}
                            onSubmit={() => {
                                if (value) {
                                    onSubmit(+value);
                                }
                            }}
                            value={inputVal}
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
    onSubmit: (size: number) => void;
    xLabel: string;
    value?: number;
}

const SmartPruner: React.FC<SmartPrunerProps> = ({
    expanded,
    id,
    label,
    madValues,
    median,
    onExpand,
    plainValues,
    onSubmit,
    xLabel,
    value,
}) => {
    const [type, setType] = useState<'raw' | 'smart'>('raw');
    const [inputVal, setInputVal] = useState<string>(value ? value + '' : '0');

    useEffect(() => {
        if (!value && inputVal != '0') {
            setInputVal('0');
        }
    }, [value]);

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
                                onChange={() => setType('raw')}
                                type="radio"
                            />
                            <RadioLabel htmlFor={`${id}raw`}>Plain</RadioLabel>
                            <RadioButton
                                checked={type === 'smart'}
                                id={`${id}smart`}
                                name={`${id}types`}
                                onChange={() => setType('smart')}
                                type="radio"
                            />
                            <RadioLabel htmlFor={`${id}smart`}>
                                Smart
                            </RadioLabel>
                        </RadioGroup>
                        {type === 'raw' && (
                            <AreaChartComponent
                                counts={plainValues}
                                onBrush={val => {
                                    setInputVal(format('.3f')(val));
                                    onSubmit(val);
                                }}
                                value={value}
                                xLabel={xLabel}
                            />
                        )}
                        {type === 'smart' && (
                            <AreaChartComponent
                                counts={madValues}
                                onBrush={val => {
                                    setInputVal(format('.3f')(val));
                                    onSubmit(median + val * median);
                                }}
                                value={value ? value / median - 1 : undefined}
                                xLabel={`${xLabel} in MADs from median`}
                            />
                        )}
                        <UpdateBox
                            onChange={v => setInputVal(v + '')}
                            onSubmit={() => {
                                if (value) {
                                    onSubmit(+value);
                                }
                            }}
                            value={inputVal}
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

const PrunerLabelContainer = styled(Row)`
    margin: 0px;
    justify-content: space-between;
    flex-grow: 0;
`;

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
