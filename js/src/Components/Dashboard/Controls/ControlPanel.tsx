import React, { useContext } from 'react';
import styled from 'styled-components';
import DisplayButtons from './DisplayButtons';
import PrunerPanel from './PrunerPanel';
import Legend from './Legend';
import { Column } from './../../Layout';
import { TreeContext } from '../Dashboard';
import Input from '../../Input';
import { Label } from '../../Typography';

const ControlPanel: React.FC = () => {
    return (
        <Group>
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
            </Column>
            <PrunerPanel />
        </Group>
    );
};

const Group = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: no-wrap;
    flex-grow: 1;
    margin: 5px;
    padding: 10px;
`;

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
                <Group>
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
                </Group>
            )}
        </Column>
    );
};
