import React, { useContext, useMemo } from 'react';
import styled from 'styled-components';
import Checkbox from '../../Checkbox';
import { DisplayContext, TreeContext } from '../Dashboard';

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
    propName: keyof DisplayContext;
    label: string;
}

const ToggleCheckbox: React.FC<ToggleCheckboxProps> = ({ propName, label }) => {
    const { displayContext, setDisplayContext } = useContext(TreeContext);
    const checked = useMemo(() => !!displayContext[propName], [displayContext]);

    const toggleTreeProp = (prop: keyof DisplayContext) =>
        setDisplayContext({
            [prop]: !displayContext[prop],
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
