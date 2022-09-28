import React, { useState } from 'react';
import { hsl } from 'd3-color';
import { bindActionCreators } from 'redux';
import { NumberInput } from '../../Input';
import { Column, Row } from '../../Layout';
import { Label } from '../../Typography';
import { selectAnnotationSlice } from '../../../redux/annotationSlice';
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
import AnnotationControls from './AnnotationControls';
import DisplaySettings from './DisplaySettings';
import ExportControls from './ExportControls';
import PrunerPanel from './PrunerPanel';
import Legend from './Legend';

const DisplayControls: React.FC = () => {
    const {
        scales: {
            branchSizeScale,
            colorScale: {
                variant: colorScaleType,
                featureGradientScaleType,
                featureGradientRange,
                featureScaleSaturation,
                userAnnotationDomain,
            },
            pieScale,
        },
        toggleableFeatures: { widthScalingDisabled },
    } = useAppSelector(selectDisplayConfig);

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

    const handleScaleSilderChange =
        (scaleType: 'branchSizeScale' | 'pieScale') =>
        (value: number | undefined) => {
            const scale =
                scaleType === 'branchSizeScale' ? branchSizeScale : pieScale;
            updateLinearScale({
                [scaleType]: {
                    range: [scale.range[0], value],
                },
            });
        };

    const { activeFeatures } = useAppSelector(selectAnnotationSlice);

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
                {(!!activeFeatures.length || !!userAnnotationDomain.length) && (
                    <Row>
                        <RadioGroup>
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
                        </RadioGroup>
                    </Row>
                )}
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
                {!!userAnnotationDomain.length && (
                    <Row>
                        <RadioGroup>
                            <RadioButton
                                checked={colorScaleType === 'userAnnotation'}
                                id='user-annotation'
                                name='user-annotation'
                                onChange={() =>
                                    updateColorScaleType('userAnnotation')
                                }
                                type='radio'
                            />
                            <RadioLabel htmlFor='user-annotation'>
                                User Annotations
                            </RadioLabel>
                        </RadioGroup>
                    </Row>
                )}
                <Row>
                    <Legend />
                </Row>

                <Row>
                    <DisplaySettings />
                </Row>
                <Row>
                    <Column xs={12}>
                        <Slider
                            disabled={widthScalingDisabled}
                            label='Adjust Max Width'
                            max={Math.max(50, branchSizeScale.range[1])}
                            min={branchSizeScale.range[0]}
                            onChange={handleScaleSilderChange(
                                'branchSizeScale'
                            )}
                            value={branchSizeScale.range[1]}
                        />
                        <Slider
                            disabled={widthScalingDisabled}
                            label='Adjust Max Pie Size'
                            max={Math.max(50, pieScale.range[1])}
                            min={pieScale.range[0]}
                            onChange={handleScaleSilderChange('pieScale')}
                            value={pieScale.range[1]}
                        />
                        {[
                            'featureAverage',
                            'featureHiLos',
                            'userAnnotation',
                        ].includes(colorScaleType) && (
                            <Slider
                                label='Adjust Saturation'
                                max={5}
                                min={0}
                                onChange={featureScaleSaturation =>
                                    updateColorScale({
                                        featureScaleSaturation,
                                    })
                                }
                                step={0.05}
                                value={
                                    featureScaleSaturation ??
                                    hsl(featureGradientRange[1]).s ??
                                    0
                                }
                            />
                        )}
                    </Column>
                </Row>
            </Column>
            <Column xs={6}>
                <Row>
                    <AnnotationControls />
                </Row>
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
    disabled?: boolean;
    label: string;
    min: number;
    max: number;
    onChange: (val: number | undefined) => void;
    step?: number;
    value: number;
}

const Slider: React.FC<SliderProps> = ({
    disabled,
    label,
    max,
    min,
    onChange,
    step,
    value,
}) => {
    const [internalMax, setInternalMax] = useState(max);

    const onManualInputchange = (val?: number) => {
        if (val) {
            setInternalMax(val);
        }
        onChange(val);
    };

    return (
        <Row>
            <Column xs={12}>
                <Row>
                    <Label>{label}</Label>
                </Row>
                <Row>
                    <input
                        disabled={!!disabled}
                        max={internalMax}
                        min={min}
                        onChange={e => onChange(+e.currentTarget.value)}
                        step={step || 1}
                        type='range'
                        value={value}
                    />

                    <NumberInput
                        ml='10px'
                        onChange={v => onManualInputchange(v)}
                        value={value}
                        width='50px'
                    />
                </Row>
            </Column>
        </Row>
    );
};
