import React, { useMemo } from 'react';
import { bindActionCreators } from 'redux';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    selectDisplayConfig,
    ToggleableDisplayElements,
    toggleDisplayProperty,
    updateLinearScale as _updateLinearScale,
} from '../../../redux/displayConfigSlice';
import Checkbox from '../../Checkbox';
import { Column, WidgetTitle } from '../../Layout';

const DisplaySettings: React.FC = () => {
    const {
        scales: { branchSizeScale, pieScale },
        treeMetadata: { minValue, maxValue },
    } = useAppSelector(selectDisplayConfig);

    const branchScalingDisabled = useMemo(() => {
        return branchSizeScale.domain[0] === branchSizeScale.domain[1];
    }, [branchSizeScale]);

    const { updateLinearScale } = bindActionCreators(
        {
            updateLinearScale: _updateLinearScale,
        },
        useAppDispatch()
    );

    return (
        <Column xs={12}>
            <WidgetTitle title='Display Settings' />
            <ToggleCheckbox label='Show Strokes' propName='strokeVisible' />
            <ToggleCheckbox label='Show Node IDs' propName='nodeIdsVisible' />
            <ToggleCheckbox
                label='Show Observation Counts'
                propName='nodeCountsVisible'
            />
            <ToggleCheckbox label='Show Distance' propName='distanceVisible' />
            <ToggleCheckbox label='Show Pies' propName='piesVisible' />
            <Checkbox
                checked={branchScalingDisabled}
                label='Disable branch width scaling'
                onClick={() =>
                    updateLinearScale({
                        branchSizeScale: {
                            domain: branchScalingDisabled
                                ? [minValue, maxValue]
                                : [1, 1],
                        },
                        pieScale: {
                            domain: branchScalingDisabled
                                ? [minValue, maxValue]
                                : [1, 1],
                        },
                    })
                }
            />
        </Column>
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
