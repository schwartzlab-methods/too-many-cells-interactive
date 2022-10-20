import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled, { createGlobalStyle, ThemeProvider } from 'styled-components';
import { Column, Row } from '../Layout';
import { Accent, Main, Primary } from '../Typography';
import { calculateTreeLayout } from '../../util';
import { useAppSelector, useElementResize } from '../../hooks';
import { selectDisplayConfig } from '../../redux/displayConfigSlice';
import { getData } from '../../prepareData';
import { TMCHierarchyPointNode } from '../../types';
import theme from '../../theme';
import TreeControls from './Chart/TreeControls';
import PruneHistory from './DisplayControls/PruneHistory';
import DisplayControls from './DisplayControls/DisplayControls';
import TreeComponent from './Chart/TreeComponent';

const GlobalStyle = createGlobalStyle`
    body {
        box-sizing: border-box;
        font-family: Helvetica, Arial, Sans-Serif;
        margin: 0;
        padding: 0;
    }
`;

const MainContainer = styled.div`
    display: flex;
    justify-content: center;
`;

const ColumnContainer = styled.div`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    justify-content: center;
    max-width: 1800px;
    padding: 15px;
`;

const Dashboard: React.FC = () => {
    const [baseTree, setBaseTree] = useState<TMCHierarchyPointNode>();

    const { width } = useAppSelector(selectDisplayConfig);

    const {
        setRef,
        ref,
        size: { height },
    } = useElementResize();

    const treeViewportRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        if (treeViewportRef.current && !ref) {
            setRef(treeViewportRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [treeViewportRef.current, ref, setRef]);

    useEffect(() => {
        const cb = async () => {
            const data = await getData();
            setBaseTree(calculateTreeLayout(data, width));
        };
        cb();
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <GlobalStyle />
            <MainContainer>
                <ColumnContainer>
                    <Row>
                        <Main>
                            <Primary>TooManyCells</Primary>
                            <Accent>Interactive</Accent>
                        </Main>
                    </Row>
                    <Row alignItems='flex-start' justifyContent='center'>
                        <Column xs={12} md={6}>
                            <TreeControls />
                            {baseTree && (
                                <TreeComponent
                                    ref={treeViewportRef}
                                    baseTree={baseTree}
                                />
                            )}
                        </Column>
                        <Column xs={12} md={6}>
                            <Row>
                                <PruneHistory />
                            </Row>
                            <Row alignItems='flex-start'>
                                <DisplayControls maxHeight={height} />
                            </Row>
                        </Column>
                    </Row>
                </ColumnContainer>
            </MainContainer>
        </ThemeProvider>
    );
};

export default Dashboard;
