import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Input } from '../../Input';
import Checkbox from '../../Checkbox';
import { Column, Row } from '../../Layout';
import { Label } from '../../Typography';
import FeatureSearch from '../FeatureSearch/FeatureSearch';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
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
        colorScale: { variant: colorScaleType, expressionThresholds },
    } = useAppSelector(selectScales);

    const { minValue, maxValue } = useAppSelector(selectTreeMetadata);

    const dispatch = useAppDispatch();

    const branchScalingDisabled = useMemo(() => {
        return branchSizeScale.domain[0] === branchSizeScale.domain[1];
    }, [branchSizeScale]);

    /* todo: reenable */
    /* note that all this could come from meta (as in, high and low count for range and domain) */
    const featureScaleAvailable = false;

    /* this should just be togglescale type */
    const toggleScale = (scaleType: typeof colorScaleType) =>
        dispatch(updateColorScaleType(scaleType));

    return (
        <>
            <Column width={'50%'}>
                <DisplayButtons />
                <Legend />
                {featureScaleAvailable && (
                    <RadioGroup>
                        <RadioButton
                            checked={colorScaleType === 'featureCount'}
                            id="featureCount"
                            name="featureCount"
                            onChange={toggleScale.bind(null, 'featureCount')}
                            type="radio"
                        />
                        <RadioLabel htmlFor="featureCount">
                            Show Features
                        </RadioLabel>
                        <RadioButton
                            checked={colorScaleType === 'labelCount'}
                            id="labelCount"
                            name="labelCount"
                            onChange={toggleScale.bind(null, 'labelCount')}
                            type="radio"
                        />
                        <RadioLabel htmlFor="labelCount">
                            Show Labels
                        </RadioLabel>
                    </RadioGroup>
                )}
                <SliderGroup>
                    <Slider
                        label="Adjust Max Width"
                        scaleType="branchSizeScale"
                        max={50}
                    />
                    <Slider
                        label="Adjust Max Pie Size"
                        scaleType="pieScale"
                        max={50}
                    />
                </SliderGroup>
                <Checkbox
                    checked={branchScalingDisabled}
                    label="Branch width scaling disabled"
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
            <Column width="50%">
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
                        type="range"
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
