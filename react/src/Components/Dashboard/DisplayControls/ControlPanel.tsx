import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Input } from '../../Input';
import Checkbox from '../../Checkbox';
import { Column, Row } from '../../Layout';
import { Label } from '../../Typography';
import { selectFeatureSlice } from '../../../redux/featureSlice';
import FeatureSearch from '../FeatureSearch/FeatureSearch';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    activateContinuousFeatureScale,
    selectScales,
    selectTreeMetadata,
    updateColorScaleType,
    updateLinearScale,
} from '../../../redux/displayConfigSlice';
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';
import DisplayButtons from './DisplayButtons';
import PrunerPanel from './PrunerPanel';
import Legend from './Legend';

const ControlPanel: React.FC = () => {
    const {
        branchSizeScale,
        colorScale: { variant: colorScaleType, featureVariant },
    } = useAppSelector(selectScales);

    const { minValue, maxValue } = useAppSelector(selectTreeMetadata);

    const { activeFeatures, featureDistributions } =
        useAppSelector(selectFeatureSlice);

    const dispatch = useAppDispatch();

    const branchScalingDisabled = useMemo(() => {
        return branchSizeScale.domain[0] === branchSizeScale.domain[1];
    }, [branchSizeScale]);

    const featureScaleAvailable = !!activeFeatures.length;

    const changeScaleType = (scaleType: typeof colorScaleType) =>
        dispatch(updateColorScaleType(scaleType));

    const _activateContinuousFeatureScale = (
        variant: 'two-color' | 'opacity'
    ) => {
        const activeFeature = activeFeatures[0];
        const max = featureDistributions[activeFeature].maxProportion;
        dispatch(activateContinuousFeatureScale({ max, variant }));
    };

    return (
        <>
            <Column width={'50%'}>
                <DisplayButtons />
                <Legend />
                {featureScaleAvailable && (
                    <RadioGroup>
                        <RadioButton
                            checked={colorScaleType === 'featureHiLos'}
                            id='featureHiLos'
                            name='featureHiLos'
                            onChange={changeScaleType.bind(
                                null,
                                'featureHiLos'
                            )}
                            type='radio'
                        />
                        <RadioLabel htmlFor='featureHiLos'>
                            Show Features
                        </RadioLabel>
                        <RadioButton
                            checked={colorScaleType === 'labelCount'}
                            id='labelCount'
                            name='labelCount'
                            onChange={changeScaleType.bind(null, 'labelCount')}
                            type='radio'
                        />
                        <RadioLabel htmlFor='labelCount'>
                            Show Labels
                        </RadioLabel>
                        {activeFeatures.length === 1 && (
                            <>
                                <RadioButton
                                    checked={
                                        colorScaleType === 'featureCount' &&
                                        featureVariant === 'opacity'
                                    }
                                    id='featureCount'
                                    name='featureCount'
                                    onChange={_activateContinuousFeatureScale.bind(
                                        null,
                                        'opacity'
                                    )}
                                    type='radio'
                                />
                                <RadioLabel htmlFor='featureCount'>
                                    Color Features
                                </RadioLabel>
                                <RadioButton
                                    checked={
                                        colorScaleType === 'featureCount' &&
                                        featureVariant === 'two-color'
                                    }
                                    id='two-color'
                                    name='two-color'
                                    onChange={_activateContinuousFeatureScale.bind(
                                        null,
                                        'two-color'
                                    )}
                                    type='radio'
                                />
                                <RadioLabel htmlFor='two-color'>
                                    Show Feature Opacity
                                </RadioLabel>
                            </>
                        )}
                    </RadioGroup>
                )}
                <SliderGroup>
                    <Slider
                        label='Adjust Max Width'
                        scaleType='branchSizeScale'
                        max={50}
                    />
                    <Slider
                        label='Adjust Max Pie Size'
                        scaleType='pieScale'
                        max={50}
                    />
                </SliderGroup>
                <Checkbox
                    checked={branchScalingDisabled}
                    label='Branch width scaling disabled'
                    onClick={() =>
                        dispatch(
                            updateLinearScale({
                                branchSizeScale: {
                                    domain: branchScalingDisabled
                                        ? [minValue, maxValue]
                                        : [1, 1],
                                },
                            })
                        )
                    }
                />
            </Column>
            <Column width='50%'>
                <PrunerPanel />
                <FeatureSearch />
            </Column>
        </>
    );
};

export default ControlPanel;

const SliderGroup = styled(Column)`
    margin-top: 15px;
`;

interface SliderProps {
    scaleType: 'branchSizeScale' | 'pieScale';
    label: string;
    max: number;
}

const Slider: React.FC<SliderProps> = ({ scaleType, label, max }) => {
    const scale = useAppSelector(selectScales)[scaleType];

    const dispatch = useAppDispatch();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(
            updateLinearScale({
                [scaleType]: {
                    range: [scale.range[0], +e.currentTarget.value],
                },
            })
        );
    };

    return (
        <Column>
            <Label>{label}</Label>
            {scale && (
                <Row>
                    <input
                        type='range'
                        max={max}
                        min={scale.range[0]}
                        step={1}
                        value={scale.range[1]}
                        onChange={handleChange}
                    />
                    <Input value={scale.range[1]} onChange={handleChange} />
                </Row>
            )}
        </Column>
    );
};
