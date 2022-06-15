import React, { useContext, useMemo } from 'react';
import { extent } from 'd3-array';
import styled from 'styled-components';
import { Input } from '../../Input';
import Checkbox from '../../Checkbox';
import { Column, Row } from '../../Layout';
import { TreeContext } from '../Dashboard';
import { Label } from '../../Typography';
import FeatureSearch from '../FeatureSearch/FeatureSearch';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    selectScales,
    updateColorScale,
    updateLinearScale,
} from '../../../redux/displayConfigSlice';
import { calculateColorScaleRangeAndDomain } from '../../../util';
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';
import DisplayButtons from './DisplayButtons';
import PrunerPanel from './PrunerPanel';
import Legend from './Legend';

const ControlPanel: React.FC = () => {
    const { displayContext } = useContext(TreeContext);
    const { visibleNodes } = displayContext;

    const {
        branchSizeScale,
        colorScale: { variant: colorScaleType, expressionThresholds },
    } = useAppSelector(selectScales);

    const dispatch = useAppDispatch();

    const branchScalingDisabled = useMemo(() => {
        return branchSizeScale.domain[0] === branchSizeScale.domain[1];
    }, [branchSizeScale]);

    const featureScaleAvailable = useMemo(() => {
        return !!Object.keys(visibleNodes?.data.featureCount || {}).length;
    }, [visibleNodes?.data.featureCount]);

    const toggleScale = (scaleType: typeof colorScaleType) =>
        dispatch(
            updateColorScale({
                variant: scaleType,
                expressionThresholds,
                ...calculateColorScaleRangeAndDomain(scaleType, visibleNodes!),
            })
        );

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
                                        ? (extent(
                                              visibleNodes!
                                                  .descendants()
                                                  .map(d => d.value!)
                                          ) as [number, number])
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
