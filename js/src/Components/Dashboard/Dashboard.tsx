import { HierarchyNode } from 'd3-hierarchy';
import { ScaleLinear, ScaleOrdinal } from 'd3-scale';
import React, { createContext, useEffect, useState } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { TMCNode } from '../../types';
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
    piesVisible?: boolean;
    rootPositionedTree?: HierarchyNode<TMCNode>;
    strokeVisible?: boolean;
    visibleNodes?: HierarchyNode<TMCNode>;
    w?: number;
}

interface TreeContext extends BaseTreeContext {
    setTreeContext?: (newContext: Partial<BaseTreeContext>) => void;
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
                <Container>
                    <Group>
                        {data && (
                            <TreeComponent
                                onLoad={tree => {
                                    if (!Object.values(treeContext).length) {
                                        setTreeContext({
                                            branchSizeScale:
                                                tree.branchSizeScale,
                                            distanceVisible:
                                                tree.distanceVisible,
                                            labelScale: tree.labelScale,
                                            nodeIdsVisible: tree.nodeIdsVisible,
                                            nodeCountsVisible:
                                                tree.nodeCountsVisible,
                                            piesVisible: tree.piesVisible,
                                            rootPositionedTree:
                                                tree.rootPositionedTree,
                                            strokeVisible: tree.strokeVisible,
                                            visibleNodes: tree.visibleNodes,
                                            w: tree.w,
                                        });
                                    }
                                }}
                                data={data}
                            />
                        )}
                    </Group>
                    <Group>{<ControlPanel />}</Group>
                </Container>
            </TreeContext.Provider>
        </ThemeProvider>
    );
};

export default Dashboard;

const Container = styled.div`
    display: flex;
    flex-direction: row;
    font-family: Ariel;
`;

const Group = styled.div`
    display: flex;
    flex-direction: row;
    flex-basis: 50%;
    flex-grow: 1;
`;
