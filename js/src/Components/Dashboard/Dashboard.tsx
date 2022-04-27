import { HierarchyNode } from 'd3-hierarchy';
import { ScaleLinear, ScaleOrdinal } from 'd3-scale';
import React, { createContext, useCallback, useEffect, useState } from 'react';
import { ThemeProvider } from 'styled-components';
import { TMCNode } from '../../types';
import { Column, Row } from '../Layout';
import { Title } from '../Typography';
import { getData } from './../../prepareData';
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

export interface PruneContext {
    pruneCondition: {
        depth?: number;
        minSize?: number;
        minDistance?: number;
        minDistanceSearch?: number;
    };
    rootNode?: string; // original id
    collapsedNodes?: string[];
}

/* 
    todo: we may never actually need to set visibleNodes or rootPositioned tree outside of the tree component, so
        we may not ever need *setters* for these values, though the pruners will need to read rootpositioned tree at the least, i think 

*/
export interface BaseTreeContext {
    displayContext: DisplayContext;
    pruneContext: PruneContext;
    rootPositionedTree?: HierarchyNode<TMCNode>;
    visibleNodes?: HierarchyNode<TMCNode>;
}

interface TreeContext extends BaseTreeContext {
    setDisplayContext: (newContext: DisplayContext) => void;
    setPruneContext: (newContext: Partial<PruneContext>) => void;
}

export const TreeContext = createContext<TreeContext>({
    /* initialize so that typescript doesn't complain about the value possibly being null */
    displayContext: {},
    pruneContext: {
        pruneCondition: {},
    },
    setDisplayContext: (newContext: DisplayContext) => {
        throw 'Uninitialized context!';
    },
    setPruneContext: (newContext: Partial<PruneContext>) => {
        throw 'Uninitialized context!';
    },
});

const Dashboard: React.FC = () => {
    const [data, setData] = useState<HierarchyNode<TMCNode>>();
    const [treeContext, _setTreeContext] = useState<BaseTreeContext>({
        displayContext: {},
        pruneContext: {
            pruneCondition: {},
        },
    });

    const setDisplayContext = useCallback(
        (contextSlice: DisplayContext) =>
            _setTreeContext({
                ...treeContext,
                displayContext: {
                    ...treeContext.displayContext,
                    ...contextSlice,
                },
            }),
        [treeContext]
    );

    const setPruneContext = useCallback(
        (contextSlice: Partial<PruneContext>) =>
            _setTreeContext({
                ...treeContext,
                pruneContext: {
                    ...treeContext.pruneContext,
                    ...contextSlice,
                },
            }),
        [treeContext]
    );

    useEffect(() => {
        setData(getData());
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <TreeContext.Provider
                value={{ ...treeContext, setDisplayContext, setPruneContext }}
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
