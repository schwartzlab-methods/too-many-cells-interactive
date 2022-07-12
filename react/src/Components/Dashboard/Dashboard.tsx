import React, { useEffect, useState } from 'react';
import { HierarchyPointNode } from 'd3-hierarchy';
import styled, { createGlobalStyle, ThemeProvider } from 'styled-components';
import { TMCNode } from '../../types';
import { Column, ResponsiveRow, Row } from '../Layout';
import { Accent, Main, Primary } from '../Typography';
import { calculateTreeLayout } from '../../util';
import { useAppSelector } from '../../hooks';
import { selectWidth } from '../../redux/displayConfigSlice';
import { getData } from '../../prepareData';
import TreeControls from './Chart/TreeControls';
import PruneHistory from './DisplayControls/PruneHistory';
import DisplayControls from './DisplayControls/DisplayControls';
import TreeComponent from './Chart/TreeComponent';

export const theme = {
    palette: {
        grey: '#5e6365',
        lightGrey: '#d1d9dd',
        primary: '#009FFD',
        text: '#000000',
        white: '#ffffff',
    },
    breakpoints: {
        lg: '1200px',
        md: '900px',
    },
};

const GlobalStyle = createGlobalStyle`
    body {
        font-family: Arial;
    }
`;

const Container = styled(Column)`
    max-width: 1800px;
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
            <Column alignItems='center'>
                <Container>
                    <Row>
                        <Main>
                            <Primary>TooManyCells</Primary>
                            <Accent>Interactive</Accent>
                        </Main>
                    </Row>
                    <ResponsiveRow mdUp alignItems='flex-start' margin='0px'>
                        <Row>
                            <Column>
                                <TreeControls />
                                {baseTree && (
                                    <TreeComponent baseTree={baseTree} />
                                )}
                            </Column>
                        </Row>
                        <Row>
                            <Column justifyContent='flex-start'>
                                <Row margin='0px'>
                                    <PruneHistory />
                                </Row>
                                <Row margin='0px' alignItems='flex-start'>
                                    <DisplayControls />
                                </Row>
                            </Column>
                        </Row>
                    </ResponsiveRow>
                </Container>
            </Column>
        </ThemeProvider>
    );
};

export default Dashboard;
