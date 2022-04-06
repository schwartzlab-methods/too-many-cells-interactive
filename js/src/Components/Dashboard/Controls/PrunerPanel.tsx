import { median, min, range, ticks } from 'd3-array';
import { HierarchyNode } from 'd3-hierarchy';
import React, { useContext, useMemo, useState } from 'react';
import styled from 'styled-components';
import { TMCNode } from '../../../types';
import { buildTree, getMAD, pruneTreeByMinValue } from '../../../util';
import { TreeContext } from '../Dashboard';
import Button from '../../Button';

interface PrunerPanelProps {}

type Pruner = 'distance' | 'distanceSearch' | 'size';

const initialPrunerVal = {
    distance: 0,
    distanceSearch: 0,
    size: 0,
};

const PrunerPanel: React.FC<PrunerPanelProps> = ({}) => {
    const [prunerVals, setPrunerVals] =
        useState<Record<Pruner, number>>(initialPrunerVal);

    const treeContext = useContext(TreeContext);

    const sizeGroups = useMemo(() => {
        if (treeContext.rootPositionedTree) {
            return getSizeGroups(treeContext.rootPositionedTree!);
        } else return {};
    }, [treeContext.rootPositionedTree]);

    const updatePrunerVal = (pruner: Pruner) => (val: number) =>
        setPrunerVals({ ...initialPrunerVal, [pruner]: val });

    const updateMaxNodeSize = () => {
        const pruned = pruneTreeByMinValue(
            treeContext.rootPositionedTree!,
            prunerVals.size
        );

        const visibleNodes = buildTree(pruned, treeContext.w!);

        treeContext.setTreeContext!({
            visibleNodes,
        });
    };

    return (
        <div>
            {treeContext.rootPositionedTree && (
                <Pruner
                    onChange={updatePrunerVal('size')}
                    onSubmit={updateMaxNodeSize}
                    values={sizeGroups}
                    value={prunerVals.size}
                />
            )}
        </div>
    );
};

export default PrunerPanel;

/* there's a range, so min, max, step  */
interface PrunerProps {
    values: Record<number, number>;
    value: number;
    onChange: (val: number) => void;
    onSubmit: () => void;
}

const Pruner: React.FC<PrunerProps> = ({
    onChange,
    onSubmit,
    value,
    values,
}) => {
    return (
        <div>
            <Input
                onChange={v => onChange(+v.currentTarget.value)}
                value={value}
            />
            <Button onClick={() => onSubmit()}>Submit</Button>
        </div>
    );
};

const Input = styled('input')`
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
        (acc, curr) => ({
            ...acc,
            [curr]: pruneTreeByMinValue(tree, curr).descendants().length,
        }),
        {}
    );
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` >= median + (n * MAD) in tree
 */
const getMadGroups = (tree: HierarchyNode<TMCNode>) => {
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
        (acc, curr) => ({
            ...acc,
            [curr.mads]: pruneTreeByMinValue(tree, curr.size).descendants()
                .length,
        }),
        {}
    );
};
