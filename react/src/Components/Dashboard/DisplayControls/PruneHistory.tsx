import React, { useContext } from 'react';
import styled from 'styled-components';
import {
    formatDistance,
    formatInteger,
    pruneContextIsEmpty,
} from '../../../util';
import Button from '../../Button';
import { Column, Row } from '../../Layout';
import { Text, Title } from '../../Typography';
import { makeFreshPruneContext, PruneContext, TreeContext } from '../Dashboard';

const PruneHistory: React.FC = () => {
    const treeContext = useContext(TreeContext);
    const { activePrune, setActivePrune, setTreeContext } = treeContext;

    return (
        <Column>
            <PruneHistoryContainer>
                <Row margin="0px">
                    <Title>Pruning History</Title>
                    <span>
                        <Button
                            horizontal
                            disabled={
                                treeContext.pruneContext.length === 1 &&
                                pruneContextIsEmpty(
                                    treeContext.pruneContext.slice(-1)[0]
                                )
                            }
                            onClick={() =>
                                setTreeContext({
                                    activePrune: 0,
                                    pruneContext: [makeFreshPruneContext()],
                                })
                            }
                        >
                            Reset
                        </Button>
                        <Button
                            horizontal
                            onClick={() => {
                                const pruneContext =
                                    treeContext.pruneContext.slice();
                                pruneContext.push(makeFreshPruneContext());
                                setTreeContext({
                                    pruneContext,
                                    activePrune: activePrune + 1,
                                });
                            }}
                        >
                            Apply
                        </Button>
                    </span>
                </Row>
                <StepContainer>
                    {treeContext.pruneContext.map((ctx, i) => (
                        <PruneStep
                            key={i}
                            active={i === treeContext.activePrune}
                            empty={pruneContextIsEmpty(ctx)}
                            index={i}
                            pruneContext={ctx}
                            setActive={() => {
                                setActivePrune(i);
                            }}
                        />
                    ))}
                </StepContainer>
            </PruneHistoryContainer>
        </Column>
    );
};

const StepContainer = styled(Row)`
    flex-wrap: wrap;
    margin: 0px;
    border: solid 1px gray;
    border-radius: 5px;
    padding: 5px;
}`;

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
        <PruneStepContainer onClick={setActive} active={active} empty={empty}>
            {getPruneHistoryLabel(pruneContext, index)}
        </PruneStepContainer>
    );
};

const getPruneHistoryLabel = (pruneContext: PruneContext, index: number) => {
    const { key, value } = pruneContext.valuePruner;
    const manualPruneCount = pruneContext.clickPruneHistory.length;
    const labels = [];
    if (key && value) {
        const formatter = key.startsWith('minDistance')
            ? formatDistance
            : formatInteger;
        labels.push(`${key}: ${formatter(value)}`);
    }
    if (manualPruneCount) {
        labels.push(
            `${manualPruneCount} manual prune${
                manualPruneCount > 1 ? 's' : ''
            }.`
        );
    }
    if (labels.length) {
        return (
            <>
                {labels.map(l => (
                    <Text key={l}>{l}</Text>
                ))}
            </>
        );
    } else {
        return <Text>{`Prune ${index + 1}`}</Text>;
    }
};

const PruneStepContainer = styled.div<{ active: boolean; empty: boolean }>`
    background-color: ${props =>
        props.empty ? props.theme.palette.grey : props.theme.palette.primary};
    border: ${props =>
        props.active ? `solid 3px ${props.theme.palette.secondary}` : 'auto'};
    color: white;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    padding: 5px;
    margin: 5px;
    border-radius: 3px;
`;

const PruneHistoryContainer = styled(Column)`
    padding: 10px;
`;

export default PruneHistory;
