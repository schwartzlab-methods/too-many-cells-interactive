import React from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    selectToggleableDisplayElements,
    ToggleableDisplayElements,
    toggleDisplayProperty,
} from '../../../redux/displayConfigSlice';
import Checkbox from '../../Checkbox';

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
    propName: keyof ToggleableDisplayElements;
    label: string;
}

const ToggleCheckbox: React.FC<ToggleCheckboxProps> = ({ propName, label }) => {
    const isVisible = useAppSelector(selectToggleableDisplayElements)[propName];
    const dipatch = useAppDispatch();

    return (
        <Checkbox
            checked={isVisible}
            onClick={dipatch.bind(null, toggleDisplayProperty(propName))}
            label={label}
        />
    );
};

const BoxList = styled.div`
    display: flex;
    flex-direction: column;
    width: 200px;
`;
