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
                ttText='Display consistent node IDs ignoring any changes to tree structure.'
            />
            <ToggleCheckbox
                label='Show Pruned Node IDs'
                propName='prunedNodeIdsVisible'
                ttText='Display refreshed node IDs based on the current tree structure.'
            />
            <ToggleCheckbox
                label='Show Observation Counts'
                propName='nodeCountsVisible'
            />
            <ToggleCheckbox
                label='Show Distance'
                propName='distanceVisible'
                ttText='Display the "distance" values on each parent node,
                with darker circles indicating larger values. By default,
                TooManyCells uses network modularity as a distance measure,
                with higher values indicating a greater split between children nodes.'
            />
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
    label: string;
    propName: keyof ToggleableDisplayElements;
    ttText?: string;
}

const ToggleCheckbox: React.FC<ToggleCheckboxProps> = ({
    propName,
    label,
    ttText,
}) => {
    const isVisible =
        useAppSelector(selectDisplayConfig)['toggleableFeatures'][propName];
    const dipatch = useAppDispatch();

    return (
        <Checkbox
            checked={isVisible}
            label={label}
            onClick={dipatch.bind(null, _toggleDisplayProperty(propName))}
            ttText={ttText}
        />
    );
};
