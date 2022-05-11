import React, { useContext } from 'react';
import { tree } from 'd3-hierarchy';
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
            <Row justifyContent="space-between" margin="0px">
                <Title>Pruning History</Title>
                <ButtonContainer>
                    <Button
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
                        disabled={pruneContextIsEmpty(
                            treeContext.pruneContext[activePrune]
                        )}
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
                </ButtonContainer>
            </Row>
            <Row margin="0px">
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
            </Row>
        </Column>
    );
};

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
    cursor: ${props => (props.empty ? 'auto' : 'pointer')};
    display: flex;
    flex-direction: column;
    padding: 5px;
    margin: 5px;
    border-radius: 3px;
`;

const ButtonContainer = styled.div`
    Button + Button {
        margin-left: 10px;
    }
`;

export default PruneHistory;
