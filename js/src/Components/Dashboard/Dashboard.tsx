import React, { createContext, useCallback, useEffect, useState } from 'react';
import { HierarchyNode } from 'd3-hierarchy';
import { ScaleLinear, ScaleOrdinal } from 'd3-scale';
import { ThemeProvider } from 'styled-components';
import { TMCNode } from '../../types';
import { Column, Row } from '../Layout';
import { Title } from '../Typography';
import { getData } from '../../prepareData';
import ControlPanel from './Controls/ControlPanel';
import TreeComponent from './TreeComponent';

const theme = {
    palette: {
        white: '#ffffff',
        primary: '#3a83c5',
        grey: '#5e6365',
        lightGrey: '#d1d9dd',
    },
};

export interface DisplayContext {
    branchSizeScale?: ScaleLinear<number, number>;
    distanceVisible?: boolean;
    labelScale?: ScaleOrdinal<string, string>;
    nodeIdsVisible?: boolean;
    nodeCountsVisible?: boolean;
    pieScale?: ScaleLinear<number, number>;
    piesVisible?: boolean;
    strokeVisible?: boolean;
    w?: number;
}

export type ValuePruneType =
    | 'minSize'
    | 'minDistance'
    | 'minDistanceSearch'
    | 'minDepth';

export type ClickPruneType = 'setRootNode' | 'setCollapsedNode';

export type AllPruneType = ValuePruneType | ClickPruneType;

export interface Pruner<T> {
    key?: T;
}

export interface ClickPruner extends Pruner<ClickPruneType> {
    value?: string;
}
export interface ValuePruner extends Pruner<ValuePruneType> {
    value?: number;
}
export interface AllPruner extends Pruner<AllPruneType> {
    value?: string | number;
}

export interface PruneContext {
    valuePruner: ValuePruner;
    clickPruneHistory: ClickPruner[];
}

/* 
    todo: we may never actually need to set visibleNodes or rootPositioned tree outside of the tree component, so
        we may not ever need *setters* for these values, though the pruners will need to read rootpositioned tree at the least, i think 

*/
export interface BaseTreeContext {
    displayContext: DisplayContext;
    pruneContext: PruneContext[];
    rootPositionedTree?: HierarchyNode<TMCNode>;
    visibleNodes?: HierarchyNode<TMCNode>;
}

interface TreeContext extends BaseTreeContext {
    setDisplayContext: (newContext: DisplayContext) => void;
    setPruneContext: (newContext: Partial<PruneContext>) => void;
    setTreeContext: (newContext: Partial<BaseTreeContext>) => void;
}

export const TreeContext = createContext<TreeContext>({
    /* initialize so that typescript doesn't complain about the value possibly being null */
    displayContext: { w: 2000000 },
    pruneContext: [
        {
            valuePruner: {},
            clickPruneHistory: [],
        },
    ],
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    setDisplayContext: (newContext: DisplayContext) => {
        throw 'Uninitialized setter!';
    },
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    setPruneContext: (newContext: Partial<PruneContext>) => {
        throw 'Uninitialized setter!';
    },
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    setTreeContext: (newContext: Partial<TreeContext>) => {
        throw 'Uninitialized setter!';
    },
});

const Dashboard: React.FC = () => {
    const [data, setData] = useState<HierarchyNode<TMCNode>>();
    const [treeContext, _setTreeContext] = useState<BaseTreeContext>({
        displayContext: { w: 100000 },
        pruneContext: [
            {
                valuePruner: {},
                clickPruneHistory: [],
            },
        ],
    });

    const setTreeContext = useCallback(
        (contextSlice: Partial<TreeContext>) =>
            _setTreeContext({ ...treeContext, ...contextSlice }),
        [treeContext, _setTreeContext]
    );

    const setDisplayContext = useCallback(
        (contextSlice: DisplayContext) =>
            setTreeContext({
                displayContext: {
                    ...treeContext.displayContext,
                    ...contextSlice,
                },
            }),
        [setTreeContext, treeContext.displayContext]
    );

    const setPruneContext = useCallback(
        (contextSlice: Partial<PruneContext>) => {
            const latest = treeContext.pruneContext.slice(-1)[0]!;
            const pruneContext = treeContext.pruneContext.slice(0, -1).concat({
                ...latest,
                ...contextSlice,
            });
            setTreeContext({ pruneContext });
        },
        [setTreeContext, treeContext.pruneContext]
    );

    useEffect(() => {
        setData(getData());
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <TreeContext.Provider
                value={{
                    ...treeContext,
                    setDisplayContext,
                    setPruneContext,
                    setTreeContext,
                }}
            >
                <Column>
                    <Title>TooManyCellsJs</Title>
                    <Row>
                        <Row basis="50%">
                            {data && <TreeComponent data={data} />}
                        </Row>
                        <Row basis="50%">
                            <ControlPanel />
                        </Row>
                    </Row>
                </Column>
            </TreeContext.Provider>
        </ThemeProvider>
    );
};

export default Dashboard;
