import React, { useEffect, useState } from 'react';
import { format } from 'd3-format';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import {
    addValuePrune as _addValuePrune,
    selectActivePruneStep,
    selectDistributionMetadata,
    ValuePruneType,
} from '../../../redux/pruneSlice';
import {
    AreaChartComponent,
    CaretDownIcon,
    CaretUpIcon,
} from '../../../Components';
//https://github.com/styled-components/styled-components/issues/1449
import Button from '../../Button';
import { NumberInput } from '../../Input';
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';
import { Column, Row } from '../../Layout';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import { Text } from '../../Typography';

const ChartContainer = styled.div<{ expanded: boolean }>`
    opacity: ${props => (props.expanded ? 1 : 0)};
    transition: 0.5s opacity cubic-bezier(0.73, 0.32, 0.34, 1.5);
`;

const PrunerContainer = styled.div<{ expanded: boolean }>`
    cursor: pointer;
    display: flex;
    flex-direction: column;
    height: ${props => (props.expanded ? '255px' : '25px')};
    + {PrunerContainer} {
        margin-bottom: 10px;
    }
    transition: 0.25s height cubic-bezier(.73,.32,.34,1.5);
    width: 100%;
    max-width: 320px;
`;

const PrunerLabelContainer = styled(Row)`
    margin: 0px;
    justify-content: space-between;
    flex-grow: 0;
`;

const SubmitButton = styled(Button)`
    align-self: flex-start;
    margin-left: 5px;
`;

const TextInputGroup = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
`;

const PrunerPanel: React.FC = () => {
    const [expanded, setExpanded] = useState<ValuePruneType>();

    const { addValuePrune } = bindActionCreators(
        {
            addValuePrune: _addValuePrune,
        },
        useAppDispatch()
    );

    const {
        depthGroups,
        distance: distanceMeta,
        distanceSearch: distanceSearchMeta,
        size: sizeMeta,
    } = useAppSelector(selectDistributionMetadata);

    const { step } = useAppSelector(selectActivePruneStep);

    const getPrunerVal = (key: ValuePruneType) =>
        key === step.valuePruner.key ? step.valuePruner.value : undefined;

    const onExpand = (id: ValuePruneType) => () => {
        setExpanded(expanded === id ? undefined : id);
    };

    const prune = (key: ValuePruneType) => (value: number) => {
        return addValuePrune({ key, value });
    };

    return (
        <Column>
            <SmartPruner
                expanded={expanded === 'minSize'}
                id='minSize'
                label={<Text>Prune by size</Text>}
                madValues={sizeMeta.madGroups}
                madSize={sizeMeta.mad}
                median={sizeMeta.median}
                onExpand={onExpand('minSize')}
                onSubmit={prune('minSize')}
                plainValues={sizeMeta.plainGroups}
                value={getPrunerVal('minSize')}
                xLabel='Size'
            />
            <SmartPruner
                expanded={expanded === 'minDistance'}
                id='minDistance'
                label={<Text>Prune by distance</Text>}
                madValues={distanceMeta.madGroups}
                madSize={distanceMeta.mad}
                median={distanceMeta.median}
                onExpand={onExpand('minDistance')}
                onSubmit={prune('minDistance')}
                plainValues={distanceMeta.plainGroups}
                value={getPrunerVal('minDistance')}
                xLabel='Distance'
            />
            <SmartPruner
                expanded={expanded === 'minDistanceSearch'}
                id='minDistanceSearch'
                label={<Text>Prune by distance (search)</Text>}
                madValues={distanceSearchMeta.madGroups}
                madSize={distanceSearchMeta.mad}
                median={distanceSearchMeta.median}
                onExpand={onExpand('minDistanceSearch')}
                onSubmit={prune('minDistanceSearch')}
                plainValues={distanceSearchMeta.plainGroups}
                value={getPrunerVal('minDistanceSearch')}
                xLabel='Distance (Search)'
            />
            <Pruner
                expanded={expanded === 'minDepth'}
                label='Prune by depth'
                onExpand={onExpand('minDepth')}
                onSubmit={prune('minDepth')}
                plainValues={depthGroups}
                xLabel='Depth'
                value={getPrunerVal('minDepth')}
            />
        </Column>
    );
};

export default PrunerPanel;

interface PrunerProps {
    expanded: boolean;
    label: string;
    onExpand: () => void;
    onSubmit: (size: number) => void;
    plainValues: Record<number, number>;
    xLabel: string;
    value?: number;
}

const Pruner: React.FC<PrunerProps> = ({
    expanded,
    label,
    onExpand,
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
            <PrunerLabel expanded={expanded} onClick={onExpand}>
                {label}
            </PrunerLabel>
            <ChartContainer expanded={expanded}>
                {expanded && (
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
                )}
            </ChartContainer>
        </PrunerContainer>
    );
};

interface SmartPrunerProps {
    expanded: boolean;
    id: string;
    label: JSX.Element;
    madSize: number;
    madValues: Record<number, number>;
    median: number;
    onExpand: () => void;
    plainValues: Record<number, number>;
    onSubmit: (size: number) => void;
    xLabel: string;
    value?: number;
}

export const SmartPruner: React.FC<SmartPrunerProps> = ({
    expanded,
    id,
    label,
    madValues,
    median,
    onExpand,
    plainValues,
    onSubmit,
    xLabel,
    value,
}) => {
    const [type, setType] = useState<'raw' | 'smart'>('raw');
    const [inputVal, setInputVal] = useState<string>(value ? value + '' : '0');

    useEffect(() => {
        if (!value && inputVal != '0') {
            setInputVal('0');
        }
    }, [value]);

    return (
        <PrunerContainer expanded={expanded}>
            <PrunerLabel expanded={expanded} onClick={onExpand}>
                {label}
            </PrunerLabel>
            <ChartContainer expanded={expanded}>
                {expanded && (
                    <>
                        <RadioGroup>
                            <RadioButton
                                checked={type === 'raw'}
                                id={`${id}raw`}
                                name={`${id}types`}
                                onChange={() => setType('raw')}
                                type='radio'
                            />
                            <RadioLabel htmlFor={`${id}raw`}>Plain</RadioLabel>
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
                                    setInputVal(format('.3f')(val));
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
                                    setInputVal(format('.3f')(val));
                                    onSubmit(median + val * median);
                                }}
                                value={value ? value / median - 1 : undefined}
                                xLabel={`${xLabel} in MADs from median`}
                            />
                        )}
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
                )}
            </ChartContainer>
        </PrunerContainer>
    );
};

const PrunerLabel: React.FC<{ expanded: boolean; onClick: () => void }> = ({
    children,
    expanded,
    onClick,
}) => (
    <PrunerLabelContainer onClick={onClick}>
        {children}
        {expanded ? <CaretDownIcon /> : <CaretUpIcon />}
    </PrunerLabelContainer>
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
