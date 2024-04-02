import React from 'react';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import { formatDigit, pruneStepIsEmpty } from '../../../util';
import Button from '../../Button';
import { Column, Row, WidgetTitle } from '../../Layout';
import { Text } from '../../Typography';
import {
    addStep as _addStep,
    PruneStep,
    resetHistory as _resestHistory,
    revertToStep as _revertToStep,
    selectActivePruneStep,
    selectPruneSlice,
} from '../../../redux/pruneSlice';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import { RightArrowIcon } from '../../Icons';

/* Component for displaying prune history, including apply and reset buttons */
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
        <Column xs={12}>
            <Row>
                <WidgetTitle
                    title='Pruning history'
                    helpText="Keeps track of each change to the tree structure from 'Pruning Controls'
                    or from manual changes on the tree window (such as collapsing nodes and new root nodes).
                    Select 'Apply' to set a snapshot of the structure. Select a snapshot and click 'Apply' to
                    revert the tree. Click 'Reset' to start from the original tree."
                />
                <Button
                    horizontal
                    onClick={applyPrune}
                    disabled={getApplyButtonDisabled()}
                >
                    Apply
                </Button>
                <Button
                    horizontal
                    disabled={getResetButtonDisabled()}
                    onClick={() => resetPruneHistory()}
                >
                    Reset
                </Button>
            </Row>
            <StepContainer>
                {pruneHistory.map((history, i) => (
                    <PruneStep
                        key={i}
                        active={i === activePruneIdx}
                        empty={pruneStepIsEmpty(history)}
                        index={i}
                        pruneStep={history}
                        setActive={() => revertToStep(i)}
                    />
                ))}
            </StepContainer>
        </Column>
    );
};

const StepContainer = styled.div`
    align-items: center;
    border: solid 1px gray;
    border-radius: 5px;
    display: flex;
    flex-grow: 1;
    flex-wrap: wrap;
    margin-top: 5px;
    padding: 5px;
    width: 100%;
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
        <PruneStepContainer>
            {!!index && <RightArrowIcon strokeWidth={0} />}
            <PruneStepItem onClick={setActive} active={active} empty={empty}>
                {getPruneHistoryLabel(pruneStep, index)}
            </PruneStepItem>
        </PruneStepContainer>
    );
};

/**
 *
 * @param {PruneStep} pruneStep the object represending prune state
 * @param {number} index the index of the currently active prune
 * @returns {JSX.Element} the label for the prune step
 */
const getPruneHistoryLabel = (pruneStep: PruneStep, index: number) => {
    const { name, value, displayValue } = pruneStep.valuePruner;
    const manualPruneCount = pruneStep.clickPruneHistory.length;
    const labels = [];
    if (name && value) {
        labels.push(
            `${name}: ${formatDigit(
                displayValue === 'mads'
                    ? value.madsValue || 0
                    : value.plainValue
            )}${displayValue === 'mads' ? ' MADs' : ''}`
        );
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

const PruneStepItem = styled.div<{ active: boolean; empty: boolean }>`
    background-color: ${props =>
        props.active
            ? props.theme.palette.secondary
            : props.theme.palette.grey};
    color: white;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    padding: 5px;
    margin: 5px;
    border-radius: 3px;
`;

const PruneStepContainer = styled.div`
    display: flex;
    flex-direction: row;
`;

export default PruneHistory;
