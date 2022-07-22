import React from 'react';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import { formatDistance, formatInteger, pruneStepIsEmpty } from '../../../util';
import Button from '../../Button';
import { Column, Row } from '../../Layout';
import { Text, Title } from '../../Typography';
import {
    addStep as _addStep,
    PruneStep,
    resetHistory as _resestHistory,
    revertToStep as _revertToStep,
    selectActivePruneStep,
    selectPruneSlice,
} from '../../../redux/pruneSlice';
import { useAppDispatch, useAppSelector } from '../../../hooks';

const PruneHistory: React.FC = () => {
    const { addStep, resetHistory, revertToStep } = bindActionCreators(
        {
            addStep: _addStep,
            resetHistory: _resestHistory,
            revertToStep: _revertToStep,
        },
        useAppDispatch()
    );

    const { step: activeStep, index: activePruneIdx } = useAppSelector(
        selectActivePruneStep
    );

    const { pruneHistory } = useAppSelector(selectPruneSlice);

    /**
     * Apply current step by pushing in new context and setting it active
     */
    const applyPrune = () => addStep();

    /**
     * Apply button is only enabled if we are on the latest step and that step is not empty
     */
    const getApplyButtonDisabled = () => pruneStepIsEmpty(activeStep);
    /**
     * Disable reset button if there is only one step and it is empty
     */
    const getResetButtonDisabled = () =>
        pruneHistory.length === 1 && pruneStepIsEmpty(activeStep);

    const resetPruneHistory = () => resetHistory();

    return (
        <Column>
            <PruneHistoryContainer>
                <Row margin='0px'>
                    <HistoryTitle>Pruning History</HistoryTitle>
                    <span>
                        <Button
                            horizontal
                            disabled={getResetButtonDisabled()}
                            onClick={() => resetPruneHistory()}
                        >
                            Reset
                        </Button>
                        <Button
                            horizontal
                            onClick={applyPrune}
                            disabled={getApplyButtonDisabled()}
                        >
                            Apply
                        </Button>
                    </span>
                </Row>
                <StepContainer>
                    {pruneHistory.map((history, i) => (
                        <PruneStep
                            key={i}
                            active={i === activePruneIdx}
                            empty={pruneStepIsEmpty(history)}
                            index={i}
                            pruneStep={history}
                            setActive={() => {
                                revertToStep(i);
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

const HistoryTitle = styled(Title)`
    margin: 5px;
`;

interface PruneStepProps {
    active: boolean;
    empty: boolean;
    index: number;
    pruneStep: PruneStep;
    setActive: () => void;
}

const PruneStep: React.FC<PruneStepProps> = ({
    active,
    empty,
    index,
    pruneStep,
    setActive,
}) => {
    return (
        <PruneStepContainer onClick={setActive} active={active} empty={empty}>
            {getPruneHistoryLabel(pruneStep, index)}
        </PruneStepContainer>
    );
};

const getPruneHistoryLabel = (pruneStep: PruneStep, index: number) => {
    const { key, value } = pruneStep.valuePruner;
    const manualPruneCount = pruneStep.clickPruneHistory.length;
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
