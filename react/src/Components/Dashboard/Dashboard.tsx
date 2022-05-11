import React, { createContext, useCallback, useState } from 'react';
import { HierarchyPointNode } from 'd3-hierarchy';
import { ScaleLinear, ScaleOrdinal } from 'd3-scale';
import { createGlobalStyle, ThemeProvider } from 'styled-components';
import { TMCNode } from '../../types';
import { Column, Row } from '../Layout';
import { Main } from '../Typography';
import PruneHistory from './Controls/PruneHistory';
import ControlPanel from './Controls/ControlPanel';
import TreeComponent from './TreeComponent';

const theme = {
    palette: {
        white: '#ffffff',
        primary: '#009FFD',
        grey: '#5e6365',
        lightGrey: '#d1d9dd',
        secondary: '#FFA400',
    },
};

const GlobalStyle = createGlobalStyle`
    body {
        font-family: Arial;
    }
`;

export interface DisplayContext {
    branchSizeScale?: ScaleLinear<number, number>;
    distanceVisible?: boolean;
    labelScale?: ScaleOrdinal<string, string>;
    nodeIdsVisible?: boolean;
    nodeCountsVisible?: boolean;
    pieScale?: ScaleLinear<number, number>;
    piesVisible?: boolean;
    rootPositionedTree?: Readonly<HierarchyPointNode<TMCNode>>;
    strokeVisible?: boolean;
    visibleNodes?: Readonly<HierarchyPointNode<TMCNode>>;
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

export const makeFreshPruneContext = () => ({
    valuePruner: {},
    clickPruneHistory: [],
});

export interface BaseTreeContext {
    displayContext: Readonly<DisplayContext>;
    pruneContext: Readonly<PruneContext[]>;
}

export interface TreeContext extends BaseTreeContext {
    setDisplayContext: (newContext: DisplayContext) => void;
    setPruneContext: (newContext: Partial<PruneContext>) => void;
    setTreeContext: (newContext: Partial<BaseTreeContext>) => void;
}

export const TreeContext = createContext<TreeContext>({
    /* initialize so that typescript doesn't complain about the value  being null */
    displayContext: {},
    pruneContext: [makeFreshPruneContext()],
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
    const [treeContext, _setTreeContext] = useState<BaseTreeContext>({
        displayContext: {},
        pruneContext: [makeFreshPruneContext()],
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
        [setTreeContext, treeContext]
    );

    const setPruneContext = useCallback(
        (contextSlice: Partial<PruneContext>) => {
            const latest = treeContext.pruneContext.slice(-1)[0];
            const pruneContext = treeContext.pruneContext.slice(0, -1).concat({
                ...latest,
                ...contextSlice,
            });
            setTreeContext({ pruneContext });
        },
        [setTreeContext, treeContext]
    );

    return (
        <ThemeProvider theme={theme}>
            <GlobalStyle />
            <TreeContext.Provider
                value={{
                    ...treeContext,
                    setDisplayContext,
                    setPruneContext,
                    setTreeContext,
                }}
            >
                <Column>
                    <Main>TooManyCellsJs</Main>
                    <Row margin="0px">
                        <Row basis="50%">
                            <TreeComponent />
                        </Row>
                        <Row basis="50%">
                            <Column>
                                <Row>
                                    <PruneHistory />
                                </Row>
                                <Row>
                                    <ControlPanel />
                                </Row>
                            </Column>
                        </Row>
                    </Row>
                </Column>
            </TreeContext.Provider>
        </ThemeProvider>
    );
};

export default Dashboard;
