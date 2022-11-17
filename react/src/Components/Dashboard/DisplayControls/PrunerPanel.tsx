import React, { useEffect, useMemo, useState } from 'react';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import {
    addValuePrune as _addValuePrune,
    selectActivePruneStep,
    selectPruneSlice,
    ValuePruneType,
    updatePruneValueDisplayType as _updatePruneValueDisplayType,
} from '../../../redux/pruneSlice';
import { AreaChartComponent } from '../../../Components';
//https://github.com/styled-components/styled-components/issues/1449
import Button from '../../Button';
import { NumberInput } from '../../Input';
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';
import { Column, Row, WidgetTitle } from '../../Layout';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import { Text } from '../../Typography';
import { SelectPanel } from '../..';
import { madCountToValue, roundDigit, valueToMadCount } from '../../../util';
import { CumSumBin } from '../../../Visualizations/AreaChart';
import QuestionTip from '../../QuestionTip';
import { PlainOrMADVal, ValueDisplayUnits } from '../../../types';

const ChartContainer = styled.div<{ expanded: boolean }>`
    opacity: ${props => (props.expanded ? 1 : 0)};
    transition: 0.5s opacity cubic-bezier(0.73, 0.32, 0.34, 1.5);
`;

const PrunerContainer = styled.div<{ expanded: boolean }>`
    display: flex;
    flex-direction: column;
    height: ${props => (props.expanded ? '300px' : '0px')};
    width: 100%;
    max-width: 320px;
`;

const PrunerLabelContainer = styled.div`
    margin: 0px;
    justify-content: space-between;
    flex-grow: 0;
`;

const SubmitButton = styled(Button)`
    margin-left: 5px;
`;

const TextInputGroup = styled.div`
    align-items: center;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
`;

const PrunerPanel: React.FC = () => {
    const [selected, setSelected] = useState<ValuePruneType>();
    const [panelVisible, setPanelVisible] = useState(false);

    const pruners = useMemo(() => {
        return [
            {
                title: 'Prune by Size',
                id: 'minSize',
            },
            {
                title: 'Prune by Depth',
                id: 'minDepth',
            },
            {
                title: 'Prune by Distance',
                id: 'minDistance',
            },
            {
                title: 'Prune by Distance (Search)',
                id: 'minDistanceSearch',
            },
            {
                title: 'None',
                id: undefined,
            },
        ];
    }, []);

    const { addValuePrune, updatePruneValueDisplayType } = bindActionCreators(
        {
            addValuePrune: _addValuePrune,
            updatePruneValueDisplayType: _updatePruneValueDisplayType,
        },
        useAppDispatch()
    );

    const {
        distributionMetadata: {
            depthGroups,
            distance: distanceMeta,
            distanceSearch: distanceSearchMeta,
            size: sizeMeta,
        },
    } = useAppSelector(selectPruneSlice);

    const { step } = useAppSelector(selectActivePruneStep);

    const getPrunerVal = (name: ValuePruneType) =>
        name === step.valuePruner.name ? step.valuePruner.value : undefined;

    const prune =
        (name: ValuePruneType) => (plainValue: number, madsValue?: number) =>
            addValuePrune({
                name,
                value: {
                    plainValue,
                    ...{ madsValue },
                },
            });

    return (
        <Column xs={12}>
            <WidgetTitle
                title='Pruning Controls'
                caption='Reduce node count by distance, size, or depth'
            />
            <Row>
                <SelectPanel
                    onClose={() => setPanelVisible(false)}
                    onSelect={(pruner: string | undefined) => {
                        setSelected(pruner as ValuePruneType);
                        setPanelVisible(false);
                    }}
                    open={panelVisible}
                    items={pruners}
                    selected={selected}
                >
                    <Button onClick={() => setPanelVisible(true)}>
                        Select Pruner
                    </Button>
                </SelectPanel>
            </Row>
            <Row>
                <SmartPruner
                    expanded={selected === 'minSize'}
                    id='minSize'
                    label={<Text>Prune by size</Text>}
                    madValues={sizeMeta.madGroups}
                    madSize={sizeMeta.mad}
                    median={sizeMeta.median}
                    onSubmit={prune('minSize')}
                    onViewTypeChange={updatePruneValueDisplayType}
                    plainValues={sizeMeta.plainGroups}
                    value={getPrunerVal('minSize')}
                    viewType={step.valuePruner.displayValue || 'plain'}
                    xLabel='Size'
                />
                <SmartPruner
                    expanded={selected === 'minDistance'}
                    id='minDistance'
                    label={
                        <Row>
                            <Text>Prune by distance </Text>{' '}
                            <QuestionTip
                                message='Distance values range from zero to lowest value of a root grandchild (to prevent pruning 
                                             entire tree when root grandchild distance is small).'
                            ></QuestionTip>
                        </Row>
                    }
                    madValues={distanceMeta.madGroups}
                    madSize={distanceMeta.mad}
                    median={distanceMeta.median}
                    onViewTypeChange={updatePruneValueDisplayType}
                    onSubmit={prune('minDistance')}
                    plainValues={distanceMeta.plainGroups}
                    value={getPrunerVal('minDistance')}
                    viewType={step.valuePruner.displayValue || 'plain'}
                    xLabel='Distance'
                />
                <SmartPruner
                    expanded={selected === 'minDistanceSearch'}
                    id='minDistanceSearch'
                    label={<Text>Prune by distance (search)</Text>}
                    madValues={distanceSearchMeta.madGroups}
                    madSize={distanceSearchMeta.mad}
                    median={distanceSearchMeta.median}
                    onViewTypeChange={updatePruneValueDisplayType}
                    onSubmit={prune('minDistanceSearch')}
                    plainValues={distanceSearchMeta.plainGroups}
                    value={getPrunerVal('minDistanceSearch')}
                    viewType={step.valuePruner.displayValue || 'plain'}
                    xLabel='Distance (Search)'
                />
                <Pruner
                    expanded={selected === 'minDepth'}
                    label='Prune by depth'
                    onSubmit={prune('minDepth')}
                    plainValues={depthGroups}
                    xLabel='Depth'
                    value={getPrunerVal('minDepth')}
                />
            </Row>
        </Column>
    );
};

export default PrunerPanel;

interface PrunerProps {
    expanded: boolean;
    label: string;
    onSubmit: (size: number) => void;
    plainValues: CumSumBin[];
    xLabel: string;
    value?: PlainOrMADVal;
}

const Pruner: React.FC<PrunerProps> = ({
    expanded,
    label,
    plainValues,
    onSubmit,
    value,
    xLabel,
}) => {
    const [inputVal, setInputVal] = useState<string>(value ? value + '' : '0');

    useEffect(() => {
        if (value?.plainValue) {
            setInputVal(roundDigit(value.plainValue).toString());
        }

        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
        <PrunerContainer expanded={expanded}>
            {expanded && (
                <>
                    <PrunerLabel>{label}</PrunerLabel>
                    <ChartContainer expanded={expanded}>
                        <>
                            <AreaChartComponent
                                counts={plainValues}
                                onBrush={v => onSubmit(v)}
                                value={value?.plainValue}
                                xLabel={xLabel}
                            />
                            <UpdateBox
                                onChange={v => setInputVal(v + '')}
                                onSubmit={() => {
                                    if (inputVal) {
                                        onSubmit(+inputVal);
                                    }
                                }}
                                value={inputVal}
                            />
                        </>
                    </ChartContainer>
                </>
            )}
        </PrunerContainer>
    );
};

export interface SmartPrunerProps {
    expanded: boolean;
    id: string;
    label: JSX.Element;
    madSize: number;
    madValues: CumSumBin[];
    median: number;
    onViewTypeChange: (viewType: ValueDisplayUnits) => void;
    plainValues: CumSumBin[];
    onSubmit: (value: number, madsValue?: number) => void;
    xLabel: string;
    value?: PlainOrMADVal;
    viewType?: ValueDisplayUnits;
}

export const SmartPruner: React.FC<SmartPrunerProps> = ({
    expanded,
    id,
    label,
    madValues,
    madSize,
    median,
    onViewTypeChange,
    plainValues,
    onSubmit,
    xLabel,
    value,
    viewType,
}) => {
    const [inputVal, setInputVal] = useState<string>(value ? value + '' : '0');

    useEffect(() => {
        if (value !== undefined) {
            if (viewType === 'plain') {
                setInputVal(roundDigit(value.plainValue || 0).toString());
            } else {
                setInputVal(roundDigit(value.madsValue || 0).toString() || '');
            }
        }
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, viewType]);

    return (
        <PrunerContainer expanded={expanded}>
            {expanded && (
                <>
                    <PrunerLabel>{label}</PrunerLabel>
                    <ChartContainer expanded={expanded}>
                        <>
                            <RadioGroup>
                                <RadioButton
                                    checked={viewType === 'plain'}
                                    id={`${id}raw`}
                                    name={`${id}types`}
                                    onChange={() => onViewTypeChange('plain')}
                                    type='radio'
                                />
                                <RadioLabel htmlFor={`${id}raw`}>
                                    Plain
                                </RadioLabel>
                                <RadioButton
                                    checked={viewType === 'mads'}
                                    id={`${id}smart`}
                                    name={`${id}types`}
                                    onChange={() => onViewTypeChange('mads')}
                                    type='radio'
                                />
                                <RadioLabel htmlFor={`${id}smart`}>
                                    Smart
                                </RadioLabel>
                            </RadioGroup>
                            {viewType === 'plain' && (
                                <AreaChartComponent
                                    counts={plainValues}
                                    onBrush={val =>
                                        onSubmit(
                                            val,
                                            valueToMadCount(
                                                val,
                                                median,
                                                madSize
                                            )
                                        )
                                    }
                                    value={value?.plainValue}
                                    xLabel={xLabel}
                                />
                            )}
                            {viewType === 'mads' && (
                                <AreaChartComponent
                                    counts={madValues}
                                    onBrush={val =>
                                        onSubmit(
                                            madCountToValue(
                                                val,
                                                median,
                                                madSize
                                            ),
                                            val
                                        )
                                    }
                                    value={value ? value.madsValue : undefined}
                                    xLabel={`${xLabel} in MADs from median`}
                                />
                            )}
                            <UpdateBox
                                onChange={v => setInputVal(v + '')}
                                onSubmit={() => {
                                    if (inputVal) {
                                        const madsValue =
                                            viewType === 'mads'
                                                ? +inputVal
                                                : undefined;
                                        const plainValue =
                                            viewType === 'mads'
                                                ? madCountToValue(
                                                      +inputVal,
                                                      median,
                                                      madSize
                                                  )
                                                : +inputVal;

                                        onSubmit(plainValue, madsValue);
                                    }
                                }}
                                value={inputVal}
                            />
                        </>
                    </ChartContainer>
                </>
            )}
        </PrunerContainer>
    );
};

const PrunerLabel: React.FC = ({ children }) => (
    <PrunerLabelContainer>{children}</PrunerLabelContainer>
);

interface UpdateBoxProps {
    onChange: (val: number | string) => void;
    onSubmit: (val: number | string) => void;
    value: number | string;
}

const UpdateBox: React.FC<UpdateBoxProps> = ({ onChange, onSubmit, value }) => (
    <TextInputGroup
        onKeyUp={e => {
            if (e.code === 'Enter') {
                onSubmit(value);
            }
        }}
    >
        <NumberInput
            onChange={v => !!v && onChange(v)}
            value={value as number}
        />
        <SubmitButton onClick={() => onSubmit(value)}>Update</SubmitButton>
    </TextInputGroup>
);
