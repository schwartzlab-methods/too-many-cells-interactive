import React, { useEffect, useState } from 'react';
import { HierarchyPointNode } from 'd3-hierarchy';
import { createGlobalStyle, ThemeProvider } from 'styled-components';
import { TMCNode } from '../../types';
import { Column, Row } from '../Layout';
import { Main } from '../Typography';
import { calculateTreeLayout } from '../../util';
import { useAppSelector } from '../../hooks';
import { selectWidth } from '../../redux/displayConfigSlice';
import { getData } from '../../prepareData';
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

const Dashboard: React.FC = () => {
    const [baseTree, setBaseTree] = useState<HierarchyPointNode<TMCNode>>();

    const width = useAppSelector(selectWidth);

    /* Initialize tree context on first load --nope! this needs to move up a component -- this component should not render without a tree */
    useEffect(() => {
        const cb = async () => {
            const data = await getData();
            setBaseTree(calculateTreeLayout(data, width));
        };
        cb();
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <GlobalStyle />

            <Column>
                <Main>TooManyCellsJs</Main>
                <Row alignItems="flex-start" margin="0px">
                    <Row width="50%">
                        <Column>
                            <TreeControls />
                            {baseTree && <TreeComponent baseTree={baseTree} />}
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
        </ThemeProvider>
    );
};

export default Dashboard;
