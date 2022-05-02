import React, { createContext, useCallback, useEffect, useState } from 'react';
import { extent } from 'd3-array';
import { HierarchyNode, HierarchyPointNode } from 'd3-hierarchy';
import { scaleLinear, ScaleLinear, scaleOrdinal, ScaleOrdinal } from 'd3-scale';
import styled, { ThemeProvider } from 'styled-components';
import { TMCNode } from '../../types';
import { Column, Row } from '../Layout';
import { Text, Title } from '../Typography';
import { getData } from '../../prepareData';
import { calculateTreeLayout, pruneContextIsEmpty } from '../../util';
import Button from '../Button';
import { interpolateColorScale } from '../../Visualizations/Tree';
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

const makeFreshPruneContext = () => ({
    valuePruner: {},
    clickPruneHistory: [],
});

export interface BaseTreeContext {
    displayContext: Readonly<DisplayContext>;
    pruneContext: Readonly<PruneContext[]>;
}

export interface TreeContext extends BaseTreeContext {
    setDisplayContext: (newContext: DisplayContext) => void;
    setPruneContext: (newContext: Partial<PruneContext>) => void;
    setTreeContext: (newContext: Partial<BaseTreeContext>) => void;
}

export const TreeContext = createContext<TreeContext>({
    /* initialize so that typescript doesn't complain about the value possibly being null */
    displayContext: { w: 2000000 },
    pruneContext: [makeFreshPruneContext()],
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
    const [data, setData] = useState<HierarchyNode<TMCNode>>();
    const [treeContext, _setTreeContext] = useState<BaseTreeContext>({
        displayContext: {},
        pruneContext: [makeFreshPruneContext()],
    });

    const setTreeContext = useCallback(
        (contextSlice: Partial<TreeContext>) =>
            _setTreeContext({ ...treeContext, ...contextSlice }),
        [treeContext, _setTreeContext]
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

    const setPruneContext = useCallback(
        (contextSlice: Partial<PruneContext>) => {
            const latest = treeContext.pruneContext.slice(-1)[0];
            const pruneContext = treeContext.pruneContext.slice(0, -1).concat({
                ...latest,
                ...contextSlice,
            });
            setTreeContext({ pruneContext });
        },
        [setTreeContext, treeContext]
    );

    useEffect(() => {
        const data = getData();
        const w = 1000;
        const rootPositionedTree = calculateTreeLayout(data, w);
        const labels = Array.from(
            new Set(
                rootPositionedTree
                    .descendants()
                    .flatMap(d => Object.keys(d.data.labelCount))
            )
        ).filter(Boolean) as string[];
        const scaleColors = interpolateColorScale(labels);

        setDisplayContext({
            branchSizeScale: scaleLinear([0.01, 20])
                .domain(
                    extent(
                        rootPositionedTree
                            .descendants()
                            .map(d => +(d.value || 0))
                    ) as [number, number]
                )
                .clamp(true),
            distanceVisible: false,
            labelScale: scaleOrdinal(scaleColors).domain(labels),
            nodeCountsVisible: false,
            nodeIdsVisible: false,
            pieScale: scaleLinear([5, 20])
                .domain(
                    extent(rootPositionedTree.leaves().map(d => d.value!)) as [
                        number,
                        number
                    ]
                )
                .clamp(true),
            piesVisible: true,
            rootPositionedTree,
            strokeVisible: false,
            visibleNodes: rootPositionedTree,
            w,
        });
        //todo: i don't think we need this
        setData(data);
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <TreeContext.Provider
                value={{
                    ...treeContext,
                    setDisplayContext,
                    setPruneContext,
                    setTreeContext,
                }}
            >
                <Column>
                    <Title>TooManyCellsJs</Title>
                    <Row margin="5px">
                        <Button
                            disabled={
                                treeContext.pruneContext.length === 1 &&
                                pruneContextIsEmpty(
                                    treeContext.pruneContext.slice(-1)[0]
                                )
                            }
                            onClick={() =>
                                setTreeContext({
                                    pruneContext: [makeFreshPruneContext()],
                                })
                            }
                        >
                            Reset
                        </Button>
                        <Button
                            disabled={pruneContextIsEmpty(
                                treeContext.pruneContext.slice(-1)[0]
                            )}
                            onClick={() => {
                                const pruneContext =
                                    treeContext.pruneContext.slice();
                                pruneContext.push(makeFreshPruneContext());
                                setTreeContext({ pruneContext });
                            }}
                        >
                            Apply
                        </Button>
                        {treeContext.pruneContext.map((ctx, i) => (
                            <PruneStep
                                key={i}
                                active={
                                    i === treeContext.pruneContext.length - 1
                                }
                                empty={pruneContextIsEmpty(ctx)}
                                index={i}
                                pruneContext={ctx}
                                setActive={() => {
                                    setTreeContext({
                                        pruneContext:
                                            treeContext.pruneContext.slice(
                                                0,
                                                i + 1
                                            ),
                                    });
                                }}
                            />
                        ))}
                    </Row>
                    <Row>
                        <Row basis="50%">{data && <TreeComponent />}</Row>
                        <Row basis="50%">
                            <ControlPanel />
                        </Row>
                    </Row>
                </Column>
            </TreeContext.Provider>
        </ThemeProvider>
    );
};

/* todo: 
    need 
        1. a popover explaining what's going on
*/

interface PruneStepProps {
    active: boolean;
    empty: boolean;
    index: number;
    pruneContext: PruneContext;
    setActive: () => void;
}

const PruneStep: React.FC<PruneStepProps> = ({
    active,
    empty,
    index,
    pruneContext,
    setActive,
}) => {
    return (
        <PruneStepContainer
            onClick={() => !empty && setActive()}
            active={active}
            empty={empty}
        >
            <Text>Prune {index + 1}</Text>
        </PruneStepContainer>
    );
};

const PruneStepContainer = styled.div<{ active: boolean; empty: boolean }>`
    background-color: ${props => props.theme.palette.primary};
    border: ${props =>
        props.active ? `solid 2px ${props.theme.palette.grey}` : 'auto'};
    cursor: ${props => (props.empty ? 'auto' : 'pointer')};
    display: flex;
    align-items: center;
    padding: 5px;
    margin: 5px;
    border-radius: 3px;
`;

export default Dashboard;
