import { HierarchyNode } from 'd3-hierarchy';
import { ScaleLinear, ScaleOrdinal } from 'd3-scale';
import React, { createContext, useEffect, useState } from 'react';
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

export interface BaseTreeContext {
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

interface TreeContext extends BaseTreeContext {
    setTreeContext?: (newContext: BaseTreeContext) => void;
}

export const TreeContext = createContext<TreeContext>({});

const Dashboard: React.FC = () => {
    const [data, setData] = useState<HierarchyNode<TMCNode>>();
    const [treeContext, setTreeContext] = useState<BaseTreeContext>({});

    useEffect(() => {
        setData(getData());
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <TreeContext.Provider value={{ ...treeContext, setTreeContext }}>
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
