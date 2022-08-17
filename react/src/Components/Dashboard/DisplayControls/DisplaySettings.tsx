import React, { useMemo } from 'react';
import { bindActionCreators } from 'redux';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    selectDisplayConfig,
    ToggleableDisplayElements,
    toggleDisplayProperty,
    updateLinearScale as _updateLinearScale,
} from '../../../redux/displayConfigSlice';
import { selectFeatureSlice } from '../../../redux/featureSlice';
import Checkbox from '../../Checkbox';
import { Column, WidgetSection } from '../../Layout';

const DisplaySettings: React.FC = () => {
    const { activeFeatures } = useAppSelector(selectFeatureSlice);
    const {
        scales: {
            branchSizeScale,
            colorScale: { variant: colorScaleType },
        },
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
        <WidgetSection title='Display Settings'>
            <Column>
                <ToggleCheckbox label='Show Strokes' propName='strokeVisible' />
                <ToggleCheckbox
                    label='Show Node IDs'
                    propName='nodeIdsVisible'
                />
                <ToggleCheckbox
                    label='Show Observation Counts'
                    propName='nodeCountsVisible'
                />
                <ToggleCheckbox
                    label='Show Distance'
                    propName='distanceVisible'
                />
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
                        })
                    }
                />
                {!!activeFeatures.length && colorScaleType === 'labelCount' && (
                    <ToggleCheckbox
                        label='Show feature opacity'
                        propName='showFeatureOpacity'
                    />
                )}
            </Column>
        </WidgetSection>
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
