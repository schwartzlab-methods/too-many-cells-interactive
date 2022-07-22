import React, { useEffect, useState } from 'react';
import styled, { createGlobalStyle, ThemeProvider } from 'styled-components';
import { Column, ResponsiveRow, Row } from '../Layout';
import { Accent, Main, Primary } from '../Typography';
import { calculateTreeLayout } from '../../util';
import { useAppSelector } from '../../hooks';
import { selectDisplayConfig } from '../../redux/displayConfigSlice';
import { getData } from '../../prepareData';
import { TMCHierarchyPointNode } from '../../types';
import TreeControls from './Chart/TreeControls';
import PruneHistory from './DisplayControls/PruneHistory';
import DisplayControls from './DisplayControls/DisplayControls';
import TreeComponent from './Chart/TreeComponent';

export const theme = {
    palette: {
        grey: '#5e6365',
        lightGrey: '#d1d9dd',
        primary: '#009FFD',
        secondary: '#FFA400',
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
    const [baseTree, setBaseTree] = useState<TMCHierarchyPointNode>();

    const { width } = useAppSelector(selectDisplayConfig);

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
