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
    rootPositionedTree?: HierarchyNode<TMCNode>;
    strokeVisible?: boolean;
    visibleNodes?: HierarchyNode<TMCNode>;
    w?: number;
}

export interface BaseTreeContext {
    displayContext: DisplayContext;
}

interface TreeContext extends BaseTreeContext {
    //setTreeContext: (newContext: BaseTreeContext) => void;
    setDisplayContext: (newContext: DisplayContext) => void;
}

export const TreeContext = createContext<TreeContext>({
    /* initialize so that typescript doesn't complain about the value possibly being null */
    displayContext: {},
    setDisplayContext: (newContext: DisplayContext) => {
        throw 'Uninitialized context!';
    },
});

const Dashboard: React.FC = () => {
    const [data, setData] = useState<HierarchyNode<TMCNode>>();
    const [treeContext, _setTreeContext] = useState<BaseTreeContext>({
        displayContext: {},
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

    useEffect(() => {
        setData(getData());
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <TreeContext.Provider value={{ ...treeContext, setDisplayContext }}>
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
