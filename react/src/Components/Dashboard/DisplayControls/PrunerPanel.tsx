import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'd3-format';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import {
    addValuePrune as _addValuePrune,
    selectActivePruneStep,
    selectPruneSlice,
    ValuePruneType,
} from '../../../redux/pruneSlice';
import { AreaChartComponent } from '../../../Components';
//https://github.com/styled-components/styled-components/issues/1449
import Button from '../../Button';
import { NumberInput } from '../../Input';
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';
import { Column, Row, WidgetTitle } from '../../Layout';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import { Text } from '../../Typography';
import SelectPanel from '../../SelectPanel';
import { madCountToValue, valueToMadCount } from '../../../util';
import { CumSumBin } from '../../../Visualizations/AreaChart';
import QuestionTip from '../../QuestionTip';

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

    const { addValuePrune } = bindActionCreators(
        {
            addValuePrune: _addValuePrune,
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

    const getPrunerVal = (key: ValuePruneType) =>
        key === step.valuePruner.key ? step.valuePruner.value : undefined;

    const prune = (key: ValuePruneType) => (value: number) =>
        addValuePrune({ key, value });

    return (
        <Column xs={12}>
            <WidgetTitle
                title='Pruning Controls'
                caption='Reduce node count by distance, size, or depth'
            />
            <Row>
                <Button onClick={() => setPanelVisible(true)}>
                    Select Pruner
                </Button>
            </Row>
            {panelVisible && (
                <SelectPanel
                    onClose={() => setPanelVisible(false)}
                    onSelect={(pruner: string | undefined) => {
                        setSelected(pruner as ValuePruneType);
                        setPanelVisible(false);
                    }}
                    items={pruners}
                    selected={selected}
                />
            )}
            <Row>
                <SmartPruner
                    expanded={selected === 'minSize'}
                    id='minSize'
                    label={<Text>Prune by size</Text>}
                    madValues={sizeMeta.madGroups}
                    madSize={sizeMeta.mad}
                    median={sizeMeta.median}
                    onSubmit={prune('minSize')}
                    plainValues={sizeMeta.plainGroups}
                    value={getPrunerVal('minSize')}
                    xLabel='Size'
                />
                <SmartPruner
                    expanded={selected === 'minDistance'}
                    id='minDistance'
                    label={
                        <Row>
                            <Text>Prune by distance </Text>{' '}
                            <QuestionTip
                                message='Distance values range from highest to lowest
                                             value of a root grandchild (to prevent pruning 
                                             entire tree when root child distance is small).'
                            ></QuestionTip>
                        </Row>
                    }
                    madValues={distanceMeta.madGroups}
                    madSize={distanceMeta.mad}
                    median={distanceMeta.median}
                    onSubmit={prune('minDistance')}
                    plainValues={distanceMeta.plainGroups}
                    value={getPrunerVal('minDistance')}
                    xLabel='Distance'
                />
                <SmartPruner
                    expanded={selected === 'minDistanceSearch'}
                    id='minDistanceSearch'
                    label={<Text>Prune by distance (search)</Text>}
                    madValues={distanceSearchMeta.madGroups}
                    madSize={distanceSearchMeta.mad}
                    median={distanceSearchMeta.median}
                    onSubmit={prune('minDistanceSearch')}
                    plainValues={distanceSearchMeta.plainGroups}
                    value={getPrunerVal('minDistanceSearch')}
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
    value?: number;
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
        if (!value && inputVal != '0') {
            setInputVal('0');
        }
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
                                onBrush={v => {
                                    setInputVal(format('.1f')(v));
                                    onSubmit(v);
                                }}
                                value={value}
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

interface SmartPrunerProps {
    expanded: boolean;
    id: string;
    label: JSX.Element;
    madSize: number;
    madValues: CumSumBin[];
    median: number;
    plainValues: CumSumBin[];
    onSubmit: (size: number) => void;
    xLabel: string;
    value?: number;
}

export const SmartPruner: React.FC<SmartPrunerProps> = ({
    expanded,
    id,
    label,
    madValues,
    madSize,
    median,
    plainValues,
    onSubmit,
    xLabel,
    value,
}) => {
    const [type, setType] = useState<'raw' | 'smart'>('raw');

    const [inputVal, setInputVal] = useState<string>(value ? value + '' : '0');

    const formatVal = format('.3f');

    useEffect(() => {
        //not sure about this....
        if (!value && inputVal != '0') {
            setInputVal('0');
        }

        if (value !== undefined) {
            if (type === 'raw') {
                setInputVal(formatVal(value));
            } else {
                setInputVal(formatVal(valueToMadCount(value, median, madSize)));
            }
        }
    }, [value, type]);

    return (
        <PrunerContainer expanded={expanded}>
            {expanded && (
                <>
                    <PrunerLabel>{label}</PrunerLabel>
                    <ChartContainer expanded={expanded}>
                        <>
                            <RadioGroup>
                                <RadioButton
                                    checked={type === 'raw'}
                                    id={`${id}raw`}
                                    name={`${id}types`}
                                    onChange={() => setType('raw')}
                                    type='radio'
                                />
                                <RadioLabel htmlFor={`${id}raw`}>
                                    Plain
                                </RadioLabel>
                                <RadioButton
                                    checked={type === 'smart'}
                                    id={`${id}smart`}
                                    name={`${id}types`}
                                    onChange={() => setType('smart')}
                                    type='radio'
                                />
                                <RadioLabel htmlFor={`${id}smart`}>
                                    Smart
                                </RadioLabel>
                            </RadioGroup>
                            {type === 'raw' && (
                                <AreaChartComponent
                                    counts={plainValues}
                                    onBrush={val => {
                                        setInputVal(val.toString());
                                        onSubmit(val);
                                    }}
                                    value={value}
                                    xLabel={xLabel}
                                />
                            )}
                            {type === 'smart' && (
                                <AreaChartComponent
                                    counts={madValues}
                                    onBrush={val => {
                                        setInputVal(val.toString());
                                        onSubmit(
                                            madCountToValue(
                                                val,
                                                median,
                                                madSize
                                            )
                                        );
                                    }}
                                    value={
                                        value
                                            ? valueToMadCount(
                                                  value,
                                                  median,
                                                  madSize
                                              )
                                            : undefined
                                    }
                                    xLabel={`${xLabel} in MADs from median`}
                                />
                            )}
                            <UpdateBox
                                onChange={v => setInputVal(v + '')}
                                onSubmit={() => {
                                    if (inputVal) {
                                        onSubmit(
                                            type === 'smart'
                                                ? madCountToValue(
                                                      +inputVal,
                                                      median,
                                                      madSize
                                                  )
                                                : +inputVal
                                        );
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
        <NumberInput onChange={v => onChange(v)} value={value} />
        <SubmitButton onClick={() => onSubmit(value)}>Update</SubmitButton>
    </TextInputGroup>
);
