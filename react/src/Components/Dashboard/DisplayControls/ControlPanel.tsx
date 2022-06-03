import React, { useContext, useMemo } from 'react';
import { extent } from 'd3-array';
import styled from 'styled-components';
import { Input } from '../../Input';
import Checkbox from '../../Checkbox';
import { Column, Row } from '../../Layout';
import { TreeContext } from '../Dashboard';
import { Label } from '../../Typography';
import FeatureSearch from '../FeatureSearch/FeatureSearch';
import { buildColorScale } from '../../../util';
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';
import DisplayButtons from './DisplayButtons';
import PrunerPanel from './PrunerPanel';
import Legend from './Legend';

const ControlPanel: React.FC = () => {
    const { displayContext, setDisplayContext } = useContext(TreeContext);

    const { visibleNodes, colorScaleKey } = displayContext;

    const branchScalingDisabled = useMemo(() => {
        return (
            displayContext.branchSizeScale?.domain()[0] ===
            displayContext.branchSizeScale?.domain()[1]
        );
    }, [displayContext]);

    const featureScaleAvailable = useMemo(() => {
        return !!Object.keys(visibleNodes?.data.featureCount || {}).length;
    }, [visibleNodes?.data.featureCount]);

    return (
        <>
            <Column width={'50%'}>
                <DisplayButtons />
                <Legend />
                {featureScaleAvailable && (
                    <RadioGroup>
                        <RadioButton
                            checked={colorScaleKey === 'featureCount'}
                            id="featureCount"
                            name="featureCount"
                            onChange={() =>
                                setDisplayContext({
                                    colorScaleKey: 'featureCount',
                                    colorScale: buildColorScale(
                                        'featureCount',
                                        visibleNodes!
                                    ),
                                })
                            }
                            type="radio"
                        />
                        <RadioLabel htmlFor="featureCount">
                            Show Features
                        </RadioLabel>
                        <RadioButton
                            checked={colorScaleKey === 'labelCount'}
                            id="labelCount"
                            name="labelCount"
                            onChange={() =>
                                setDisplayContext({
                                    colorScaleKey: 'labelCount',
                                    colorScale: buildColorScale(
                                        'labelCount',
                                        visibleNodes!
                                    ),
                                })
                            }
                            type="radio"
                        />
                        <RadioLabel htmlFor="labelCount">
                            Show Tissue Types
                        </RadioLabel>
                    </RadioGroup>
                )}
                <SliderGroup>
                    <Slider
                        label="Adjust Max Width"
                        contextKey="branchSizeScale"
                        max={50}
                    />
                    <Slider
                        label="Adjust Max Pie Size"
                        contextKey="pieScale"
                        max={50}
                    />
                </SliderGroup>
                <Checkbox
                    checked={branchScalingDisabled}
                    label="Branch width scaling disabled"
                    onClick={() => {
                        const branchSizeScale = displayContext.branchSizeScale;

                        if (branchSizeScale) {
                            branchSizeScale.domain(
                                branchScalingDisabled
                                    ? (extent(
                                          visibleNodes!
                                              .descendants()
                                              .map(d => d.value!)
                                      ) as [number, number])
                                    : [1, 1]
                            );
                        }

                        setDisplayContext({
                            branchSizeScale,
                        });
                    }}
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
    contextKey: 'branchSizeScale' | 'pieScale';
    label: string;
    max: number;
}

const Slider: React.FC<SliderProps> = ({ contextKey, label, max }) => {
    const { displayContext, setDisplayContext } = useContext(TreeContext);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        displayContext[contextKey]?.range([
            displayContext[contextKey]!.range()[0],
            +e.currentTarget.value,
        ]);
        setDisplayContext({
            [contextKey]: displayContext[contextKey],
        });
    };

    return (
        <Column>
            <Label>{label}</Label>
            {displayContext[contextKey] && (
                <Row>
                    <input
                        type="range"
                        max={max}
                        min={displayContext[contextKey]!.range()[0]}
                        step={1}
                        value={displayContext[contextKey]!.range()[1]}
                        onChange={handleChange}
                    />
                    <Input
                        value={displayContext[contextKey]!.range()[1]}
                        onChange={handleChange}
                    />
                </Row>
            )}
        </Column>
    );
};
