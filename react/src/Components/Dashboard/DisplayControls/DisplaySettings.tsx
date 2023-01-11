import React from 'react';
import { bindActionCreators } from 'redux';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    selectDisplayConfig,
    ToggleableDisplayElements,
    toggleDisplayProperty as _toggleDisplayProperty,
    updateLinearScale as _updateLinearScale,
} from '../../../redux/displayConfigSlice';
import Checkbox from '../../Checkbox';
import { Column, WidgetTitle } from '../../Layout';

const DisplaySettings: React.FC = () => {
    const {
        scales: { branchSizeScale, pieScale },
        toggleableFeatures: { widthScalingDisabled },
    } = useAppSelector(selectDisplayConfig);

    const { toggleDisplayProperty, updateLinearScale } = bindActionCreators(
        {
            updateLinearScale: _updateLinearScale,
            toggleDisplayProperty: _toggleDisplayProperty,
        },
        useAppDispatch()
    );

    const disableWidthScales = () => {
        toggleDisplayProperty('widthScalingDisabled');
        updateLinearScale({
            branchSizeScale: {
                defaultRange: branchSizeScale.range,
                range: [branchSizeScale.range[1], branchSizeScale.range[1]],
            },
            pieScale: {
                defaultRange: pieScale.range,
                range: [pieScale.range[1], pieScale.range[1]],
            },
        });
    };

    const enableWidthScales = () => {
        toggleDisplayProperty('widthScalingDisabled');
        updateLinearScale({
            branchSizeScale: {
                range: branchSizeScale.defaultRange,
            },
            pieScale: {
                range: pieScale.defaultRange,
            },
        });
    };

    return (
        <Column xs={12}>
            <WidgetTitle title='Display Settings' />
            <ToggleCheckbox label='Show Strokes' propName='strokeVisible' />
            <ToggleCheckbox
                label='Show Original Node IDs'
                propName='originalNodeIdsVisible'
            />
            <ToggleCheckbox
                label='Show Pruned Node IDs'
                propName='prunedNodeIdsVisible'
            />
            <ToggleCheckbox
                label='Show Observation Counts'
                propName='nodeCountsVisible'
            />
            <ToggleCheckbox label='Show Distance' propName='distanceVisible' />
            <ToggleCheckbox label='Show Pies' propName='piesVisible' />
            <Checkbox
                checked={widthScalingDisabled}
                label='Disable branch width scaling'
                onClick={
                    widthScalingDisabled
                        ? enableWidthScales
                        : disableWidthScales
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
            onClick={dipatch.bind(null, _toggleDisplayProperty(propName))}
            label={label}
        />
    );
};
