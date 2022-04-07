import React, { useContext, useMemo } from 'react';
import styled from 'styled-components';
import Button from '../../Button';
import Checkbox from '../../Checkbox';
import { BaseTreeContext, TreeContext } from '../Dashboard';

const DisplayButtons: React.FC = () => {
    return (
        <BoxList>
            <ToggleCheckbox label="Show Stroke" propName="strokeVisible" />
            <ToggleCheckbox label="Show Node IDs" propName="nodeIdsVisible" />
            <ToggleCheckbox
                label="Show Node Counts"
                propName="nodeCountsVisible"
            />
            <ToggleCheckbox label="Show Distance" propName="distanceVisible" />
            <ToggleCheckbox label="Show Pies" propName="piesVisible" />
        </BoxList>
    );
};

export default DisplayButtons;

interface ToggleCheckboxProps {
    propName: keyof BaseTreeContext;
    label: string;
}

const ToggleCheckbox: React.FC<ToggleCheckboxProps> = ({ propName, label }) => {
    const treeContext = useContext(TreeContext);
    const checked = useMemo(() => !!treeContext[propName], [treeContext]);

    const toggleTreeProp = (prop: keyof BaseTreeContext) =>
        treeContext.setTreeContext!({
            ...treeContext,
            [prop]: !treeContext[prop],
        });

    return (
        <Checkbox
            checked={checked}
            onClick={() => toggleTreeProp(propName)}
            label={label}
        />
    );
};

const BoxList = styled.div`
    display: flex;
    flex-direction: column;
    width: 200px;
`;
