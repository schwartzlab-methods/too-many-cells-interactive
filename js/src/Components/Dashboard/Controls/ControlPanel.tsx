import React, { useContext, useMemo } from 'react';
import { extent } from 'd3-array';
import styled from 'styled-components';
import { Input } from '../../Input';
import Checkbox from '../../Checkbox';
import { Column, Row } from '../../Layout';
import { TreeContext } from '../Dashboard';
import { Label } from '../../Typography';
import DisplayButtons from './DisplayButtons';
import PrunerPanel from './PrunerPanel';
import Legend from './Legend';

const ControlPanel: React.FC = () => {
    const { displayContext, setDisplayContext } = useContext(TreeContext);

    const { visibleNodes } = displayContext;

    const branchScalingDisabled = useMemo(() => {
        return (
            displayContext.branchSizeScale?.domain()[0] ===
            displayContext.branchSizeScale?.domain()[1]
        );
    }, [displayContext]);

    return (
        <Row>
            <Column>
                <DisplayButtons />
                <Legend />
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
            <PrunerPanel />
        </Row>
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
