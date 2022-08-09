import React from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    selectDisplayConfig,
    ToggleableDisplayElements,
    toggleDisplayProperty,
} from '../../../redux/displayConfigSlice';
import { selectFeatureSlice } from '../../../redux/featureSlice';
import Checkbox from '../../Checkbox';

const DisplaySettings: React.FC = () => {
    const { activeFeatures } = useAppSelector(selectFeatureSlice);
    const {
        scales: {
            colorScale: { variant: colorScaleType },
        },
    } = useAppSelector(selectDisplayConfig);

    return (
        <BoxList>
            <ToggleCheckbox label='Show Strokes' propName='strokeVisible' />
            <ToggleCheckbox label='Show Node IDs' propName='nodeIdsVisible' />
            <ToggleCheckbox
                label='Show Observation Counts'
                propName='nodeCountsVisible'
            />
            <ToggleCheckbox label='Show Distance' propName='distanceVisible' />
            <ToggleCheckbox label='Show Pies' propName='piesVisible' />
            {!!activeFeatures.length && colorScaleType === 'labelCount' && (
                <ToggleCheckbox
                    label='Show feature opacity'
                    propName='showFeatureOpacity'
                />
            )}
        </BoxList>
    );
};

export default DisplaySettings;

interface ToggleCheckboxProps {
    propName: keyof ToggleableDisplayElements;
    label: string;
}

const ToggleCheckbox: React.FC<ToggleCheckboxProps> = ({ propName, label }) => {
    const isVisible =
        useAppSelector(selectDisplayConfig)['toggleableFeatures'][propName];
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
