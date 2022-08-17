import React from 'react';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import { Input } from '../../Input';
import { Column, ResponsiveRow, Row } from '../../Layout';
import { Label } from '../../Typography';
import { selectFeatureSlice } from '../../../redux/featureSlice';
import FeatureSearch from '../FeatureSearch/FeatureSearch';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    activateFeatureColorScale as _activateContinuousFeatureScale,
    selectDisplayConfig,
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
import DisplaySettings from './DisplaySettings';
import PrunerPanel from './PrunerPanel';
import Legend from './Legend';

const DisplayControls: React.FC = () => {
    const {
        scales: {
            colorScale: { variant: colorScaleType },
        },
    } = useAppSelector(selectDisplayConfig);

    const { activeFeatures } = useAppSelector(selectFeatureSlice);

    const {
        activateContinuousFeatureScale,
        updateColorScale,
        updateColorScaleType,
    } = bindActionCreators(
        {
            activateContinuousFeatureScale: _activateContinuousFeatureScale,
            updateColorScale: _updateColorScale,
            updateColorScaleType: _updateColorScaleType,
            updateLinearScale: _updateLinearScale,
        },
        useAppDispatch()
    );

    const changeScaleType = (scaleType: typeof colorScaleType) => {
        updateColorScaleType(scaleType);
    };

    const activateOrdinalFeatureScale = () => {
        updateColorScaleType('featureHiLos');
        const featureHiLoDomain = getScaleCombinations(
            activeFeatures.filter(Boolean)
        );
        const featureHiLoRange = addGray(
            featureHiLoDomain,
            interpolateColorScale(featureHiLoDomain)
        );
        updateColorScale({
            featureHiLoDomain,
            featureHiLoRange,
        });
    };

    return (
        <>
            <Column width={'50%'}>
                <Legend />
                {!!activeFeatures.length && (
                    <Row>
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
                                onChange={changeScaleType.bind(
                                    null,
                                    'labelCount'
                                )}
                                type='radio'
                            />
                            <RadioLabel htmlFor='labelCount'>
                                Show Labels
                            </RadioLabel>
                            <RadioButton
                                checked={colorScaleType === 'featureCount'}
                                id='two-color'
                                name='two-color'
                                onChange={() =>
                                    activateContinuousFeatureScale()
                                }
                                type='radio'
                            />
                            <RadioLabel htmlFor='two-color'>
                                Show Feature Blend
                            </RadioLabel>
                        </RadioGroup>
                    </Row>
                )}

                <DisplaySettings />
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
    const { scales } = useAppSelector(selectDisplayConfig);
    const scale = scales[scaleType];

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
            <Row>
                <Label>{label}</Label>
            </Row>
            {scale && (
                <ResponsiveRow lgUp>
                    <input
                        type='range'
                        max={max}
                        min={scale.range[0]}
                        step={1}
                        value={scale.range[1]}
                        onChange={handleChange}
                    />
                    <Input value={scale.range[1]} onChange={handleChange} />
                </ResponsiveRow>
            )}
        </Column>
    );
};
