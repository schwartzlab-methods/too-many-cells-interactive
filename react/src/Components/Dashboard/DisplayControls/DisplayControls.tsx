import React from 'react';
import { bindActionCreators } from 'redux';
import { Input } from '../../Input';
import { Column, Row } from '../../Layout';
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
import ExportControls from './ExportControls';
import PrunerPanel from './PrunerPanel';
import Legend from './Legend';

const DisplayControls: React.FC = () => {
    const {
        scales: {
            colorScale: { variant: colorScaleType, featureGradientScaleType },
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
            <Column xs={6}>
                <Row>
                    <Legend />
                </Row>
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
                                Feature HiLo
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
                            <RadioLabel htmlFor='labelCount'>Labels</RadioLabel>
                            <RadioButton
                                checked={
                                    colorScaleType === 'featureAverage' &&
                                    featureGradientScaleType === 'sequential'
                                }
                                id='two-color'
                                name='two-color'
                                onChange={() =>
                                    activateContinuousFeatureScale('sequential')
                                }
                                type='radio'
                            />
                            <RadioLabel htmlFor='two-color'>
                                Feature Avg
                            </RadioLabel>
                            <RadioButton
                                checked={
                                    colorScaleType === 'featureAverage' &&
                                    featureGradientScaleType ===
                                        'symlogSequential'
                                }
                                id='two-color-sym'
                                name='two-color-sym'
                                onChange={() =>
                                    activateContinuousFeatureScale(
                                        'symlogSequential'
                                    )
                                }
                                type='radio'
                            />
                            <RadioLabel htmlFor='two-color-sym'>
                                Feature Avg SymLog
                            </RadioLabel>
                        </RadioGroup>
                    </Row>
                )}
                <Row>
                    <DisplaySettings />
                </Row>
                <Row>
                    <Column xs={12}>
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
                    </Column>
                </Row>
            </Column>
            <Column xs={6}>
                <Row>
                    <ExportControls />
                </Row>
                <Row>
                    <PrunerPanel />
                </Row>
                <Row>
                    <FeatureSearch />
                </Row>
            </Column>
        </>
    );
};

export default DisplayControls;

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
        <Row>
            <Column xs={12}>
                <Row>
                    <Label>{label}</Label>
                </Row>
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
                        <Input
                            ml='10px'
                            onChange={handleChange}
                            value={scale.range[1]}
                            width='50px'
                        />
                    </Row>
                )}
            </Column>
        </Row>
    );
};
