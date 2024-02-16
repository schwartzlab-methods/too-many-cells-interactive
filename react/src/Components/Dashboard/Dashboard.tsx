import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled, { createGlobalStyle, ThemeProvider } from 'styled-components';
import { Column, Row } from '../Layout';
import {
    Accent,
    ActionLink,
    ExternalLink,
    Main,
    Primary,
    Text,
} from '../Typography';
import {
    calculateOrdinalColorScaleRangeAndDomain,
    calculateTreeLayout,
} from '../../util';
import { useAppDispatch, useAppSelector, useElementResize } from '../../hooks';
import {
    selectDisplayConfig,
    updateColorScale,
} from '../../redux/displayConfigSlice';
import { addLabels, buildLabelMap, getData } from '../../prepareData';
import { TMCHierarchyPointNode } from '../../types';
import theme from '../../theme';
import LoadingModal from '../LoadingModal';
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
    const [loading, setLoading] = useState(false);
    const [learnMoreVisible, setLearnMoreVisible] = useState(false);

    const { width } = useAppSelector(selectDisplayConfig);

    const dispatch = useAppDispatch();

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
            setLoading(true);
            try {
                const unlabeledTree = await getData();
                const labels = await (await fetch('/files/labels.csv')).text();
                const labelMap = buildLabelMap(labels);
                const tree = addLabels(unlabeledTree, labelMap);

                const { range: labelRange, domain: labelDomain } =
                    calculateOrdinalColorScaleRangeAndDomain(labelMap);

                dispatch(updateColorScale({ labelRange, labelDomain }));

                setBaseTree(calculateTreeLayout(tree, width));
            } finally {
                setLoading(false);
            }
        };
        cb();
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <GlobalStyle />
            <MainContainer>
                <ColumnContainer>
                    <Row style={{ alignItems: 'baseline' }}>
                        <Main>
                            <Primary>TooManyCells</Primary>
                            <Accent>Interactive</Accent>
                        </Main>
                        <ActionLink
                            onClick={() =>
                                setLearnMoreVisible(!learnMoreVisible)
                            }
                        >
                            Learn More{learnMoreVisible ? '-' : '+'}
                        </ActionLink>
                    </Row>
                    {learnMoreVisible && <LearnMoreSection />}
                    <Row style={{ marginLeft: '10px' }} alignItems='flex-start'>
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
            <LoadingModal open={loading} message='LOADING TREE...' />
        </ThemeProvider>
    );
};

const LearnMoreSection: React.FC = () => (
    <Row>
        <OutlinedColumn xs={12} md={6}>
            <Text>
                <strong>TooManyCellsInteractive</strong> is an interactive
                visualization tool allowing users to explore cell cluster trees
                generated by{' '}
                <ExternalLink
                    target='_blank'
                    href='https://github.com/GregorySchwartz/too-many-cells'
                >
                    TooManyCells
                </ExternalLink>
                , a suite of tools, algorithms, and visualizations focusing on
                the relationships between cell clades.
            </Text>
            <Text>
                You can interact with the tree by <strong>dragging</strong>{' '}
                nodes or edges with the mouse. Drag the background in order to{' '}
                <strong>pan</strong> the image, and use the mouse wheel to{' '}
                <strong>zoom in and out</strong>. To{' '}
                <strong>collapse nodes</strong>, <strong>shift-click</strong>{' '}
                their common edge. To <strong>set a node as root</strong>,{' '}
                <strong>ctrl+click</strong> it.
            </Text>
            <Text>
                Use the controls on the right to{' '}
                <strong>
                    prune the tree, change display settings, overlay the tree
                    with feature values, or export the tree
                </strong>
                .
            </Text>
            <Text>
                For a detailed <strong>visual introduction</strong> to
                TooManyCellsInteractive, please visit the tutorial on the{' '}
                <ExternalLink
                    target='_blank'
                    href='https://schwartzlab-methods.github.io/too-many-cells-interactive/tutorial.html'
                >
                    documentation page
                </ExternalLink>
                .
            </Text>
        </OutlinedColumn>
    </Row>
);

const OutlinedColumn = styled(Column)`
    padding: 10px;
    font-size: 14px;
    border: thin solid gray;
    border-radius: 5px;
    ${Text} + ${Text} {
        margin-top: 5px;
    }
`;

export default Dashboard;
