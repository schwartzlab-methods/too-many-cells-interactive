import React, { useMemo } from 'react';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import { Input } from '../../Input';
import Checkbox from '../../Checkbox';
import { Column, Row } from '../../Layout';
import { Label } from '../../Typography';
import { selectFeatureSlice } from '../../../redux/featureSlice';
import FeatureSearch from '../FeatureSearch/FeatureSearch';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    activateFeatureColorScale as _activateContinuousFeatureScale,
    selectScales,
    selectTreeMetadata,
    updateColorScale as _updateColorScale,
    updateColorScaleType as _updateColorScaleType,
    updateLinearScale as _updateLinearScale,
} from '../../../redux/displayConfigSlice';
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';
import {
    addGray,
    getScaleCombinations,
    interpolateColorScale,
} from '../../../util';
import DisplayButtons from './DisplayButtons';
import PrunerPanel from './PrunerPanel';
import Legend from './Legend';

const DisplayControls: React.FC = () => {
    const {
        branchSizeScale,
        colorScale: { variant: colorScaleType, showFeatureOpacity },
    } = useAppSelector(selectScales);

    const { minValue, maxValue } = useAppSelector(selectTreeMetadata);

    const { activeFeatures } = useAppSelector(selectFeatureSlice);

    const {
        activateContinuousFeatureScale,
        updateColorScale,
        updateColorScaleType,
        updateLinearScale,
    } = bindActionCreators(
        {
            activateContinuousFeatureScale: _activateContinuousFeatureScale,
            updateColorScale: _updateColorScale,
            updateColorScaleType: _updateColorScaleType,
            updateLinearScale: _updateLinearScale,
        },
        useAppDispatch()
    );

    const branchScalingDisabled = useMemo(() => {
        return branchSizeScale.domain[0] === branchSizeScale.domain[1];
    }, [branchSizeScale]);

    const featureScaleAvailable = !!activeFeatures.length;

    const changeScaleType = (scaleType: typeof colorScaleType) => {
        updateColorScaleType(scaleType);
    };

    const activateOrdinalFeatureScale = () => {
        updateColorScaleType('featureHiLos');
        const domain = getScaleCombinations(activeFeatures.filter(Boolean));
        const range = addGray(domain, interpolateColorScale(domain));
        updateColorScale({
            featureThresholdDomain: domain,
            featureColorRange: range,
        });
    };

    return (
        <>
            <Column width={'50%'}>
                <DisplayButtons />
                {featureScaleAvailable && colorScaleType === 'labelCount' && (
                    <Checkbox
                        checked={showFeatureOpacity}
                        label='Show feature opacity'
                        onClick={updateColorScale.bind(null, {
                            showFeatureOpacity: !showFeatureOpacity,
                        })}
                    />
                )}
                {featureScaleAvailable && (
                    <RadioGroup>
                        <RadioButton
                            checked={colorScaleType === 'featureHiLos'}
                            id='featureHiLos'
                            name='featureHiLos'
                            onChange={activateOrdinalFeatureScale}
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
                        <RadioButton
                            checked={colorScaleType === 'featureCount'}
                            id='two-color'
                            name='two-color'
                            onChange={() => activateContinuousFeatureScale()}
                            type='radio'
                        />
                        <RadioLabel htmlFor='two-color'>
                            Show Feature Blend
                        </RadioLabel>
                    </RadioGroup>
                )}
                <Legend />
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
                        updateLinearScale({
                            branchSizeScale: {
                                domain: branchScalingDisabled
                                    ? [minValue, maxValue]
                                    : [1, 1],
                            },
                        })
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

export default DisplayControls;

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
            _updateLinearScale({
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
