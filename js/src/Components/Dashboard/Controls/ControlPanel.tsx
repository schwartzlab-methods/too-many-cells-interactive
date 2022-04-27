import React, { useContext, useMemo } from 'react';
import { extent } from 'd3-array';
import styled from 'styled-components';
import DisplayButtons from './DisplayButtons';
import PrunerPanel from './PrunerPanel';
import Legend from './Legend';
import { Column, Row } from './../../Layout';
import { TreeContext } from '../Dashboard';
import { Input } from '../../Input';
import { Label } from '../../Typography';
import Checkbox from '../../Checkbox';

const ControlPanel: React.FC = () => {
    const treeContext = useContext(TreeContext);

    const branchScalingDisabled = useMemo(() => {
        return (
            treeContext.branchSizeScale?.domain()[0] ===
            treeContext.branchSizeScale?.domain()[1]
        );
    }, [treeContext]);

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
                        const branchSizeScale = treeContext.branchSizeScale;

                        if (branchSizeScale) {
                            branchSizeScale.domain(
                                branchScalingDisabled
                                    ? (extent(
                                          treeContext
                                              .visibleNodes!.descendants()
                                              .map(d => d.value!)
                                      ) as [number, number])
                                    : [1, 1]
                            );
                        }

                        treeContext.setTreeContext!({
                            ...treeContext,
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
    const treeContext = useContext(TreeContext);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        treeContext[contextKey]?.range([
            treeContext[contextKey]!.range()[0],
            +e.currentTarget.value,
        ]);
        treeContext.setTreeContext!({
            ...treeContext,
            [contextKey]: treeContext[contextKey],
        });
    };

    return (
        <Column>
            <Label>{label}</Label>
            {treeContext[contextKey] && (
                <Row>
                    <input
                        type="range"
                        max={max}
                        min={treeContext[contextKey]!.range()[0]}
                        step={1}
                        value={treeContext[contextKey]!.range()[1]}
                        onChange={handleChange}
                    />
                    <Input
                        value={treeContext[contextKey]!.range()[1]}
                        onChange={handleChange}
                    />
                </Row>
            )}
        </Column>
    );
};
