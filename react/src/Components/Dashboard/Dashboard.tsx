import React, { createContext, useCallback, useState } from 'react';
import { HierarchyPointNode } from 'd3-hierarchy';
import { ScaleLinear, ScaleOrdinal } from 'd3-scale';
import { createGlobalStyle, ThemeProvider } from 'styled-components';
import { TMCNode } from '../../types';
import { Column, Row } from '../Layout';
import { Main } from '../Typography';
import TreeControls from './Chart/TreeControls';
import PruneHistory from './DisplayControls/PruneHistory';
import ControlPanel from './DisplayControls/ControlPanel';
import TreeComponent from './Chart/TreeComponent';

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
    colorScale?: ScaleOrdinal<string, string>;
    colorScaleKey?: 'featureCount' | 'labelCount';
    nodeIdsVisible?: boolean;
    nodeCountsVisible?: boolean;
    originalTree?: Readonly<HierarchyPointNode<TMCNode>>;
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
    activePrune: Readonly<number>;
    displayContext: Readonly<DisplayContext>;
    pruneContext: Readonly<PruneContext[]>;
}

export interface TreeContext extends BaseTreeContext {
    setActivePrune: (idx: number) => void;
    setDisplayContext: (newContext: DisplayContext) => void;
    setPruneContext: (newContext: Partial<PruneContext>) => void;
    setTreeContext: (newContext: Partial<BaseTreeContext>) => void;
}

export const TreeContext = createContext<TreeContext>({
    /* initialize so that typescript doesn't complain about the value  being null */
    activePrune: 0,
    displayContext: {},
    pruneContext: [makeFreshPruneContext()],
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    setActivePrune: (idx: number) => {
        throw 'Uninitialized setter!';
    },

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
        activePrune: 0,
        displayContext: {},
        pruneContext: [makeFreshPruneContext()],
    });

    const setTreeContext = useCallback(
        (contextSlice: Partial<TreeContext>) =>
            _setTreeContext({ ...treeContext, ...contextSlice }),
        [treeContext, _setTreeContext]
    );

    const setActivePrune = useCallback(
        (idx: number) => setTreeContext({ ...treeContext, activePrune: idx }),
        [treeContext, setTreeContext]
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

    /* note that we will wipe out any subsequent prune contexts here, since a prune
        change forks prune history */
    const setPruneContext = useCallback(
        (contextSlice: Partial<PruneContext>) => {
            const activeIdx = treeContext.activePrune;
            const latest = treeContext.pruneContext[activeIdx];
            const pruneContext = treeContext.pruneContext.slice(
                0,
                activeIdx + 1
            );
            const updated = {
                ...latest,
                ...contextSlice,
            };

            pruneContext[activeIdx] = updated;

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
                    setActivePrune,
                    setDisplayContext,
                    setPruneContext,
                    setTreeContext,
                }}
            >
                <Column>
                    <Main>TooManyCellsJs</Main>
                    <Row alignItems="flex-start" margin="0px">
                        <Row width="50%">
                            <Column>
                                <TreeControls />
                                <TreeComponent />
                            </Column>
                        </Row>
                        <Row width="50%">
                            <Column justifyContent="flex-start">
                                <Row margin="0px">
                                    <PruneHistory />
                                </Row>
                                <Row margin="0px" alignItems="flex-start">
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
