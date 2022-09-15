import { useMemo } from 'react';
import {
    ColorScaleConfig,
    selectDisplayConfig,
    ToggleableDisplayElements,
} from '../redux/displayConfigSlice';
import { selectAnnotationSlice } from '../redux/annotationSlice';
import { selectPruneSlice, ValuePruner } from '../redux/pruneSlice';
import useAppSelector from './useAppSelector';

export interface ScaleExport {
    branchsizeScaleRange?: [number, number];
    colorScale?: Partial<Omit<ColorScaleConfig, 'featureGradientDomain'>>;
    pieScaleRange?: [number, number];
}

export interface StateExport {
    features?: string[];
    optionalDisplayElements?: Partial<ToggleableDisplayElements>;
    pruneState?: { valuePruner: ValuePruner }[];
    scales?: ScaleExport;
    width?: number;
    fontsize?: number;
}

const useExportState = () => {
    const { activeFeatures } = useAppSelector(selectAnnotationSlice);
    const displayConfig = useAppSelector(selectDisplayConfig);
    const { pruneHistory: pruneState } = useAppSelector(selectPruneSlice);

    const state: StateExport = useMemo(
        () => ({
            features: activeFeatures,
            optionalDisplayElements: displayConfig.toggleableFeatures,
            pruneState: pruneState.map(ps => ({ valuePruner: ps.valuePruner })),
            scales: {
                branchsizeScaleRange:
                    displayConfig.scales.branchSizeScale.range,
                pieScaleRange: displayConfig.scales.pieScale.range,
                colorScale: displayConfig.scales.colorScale,
            },
            width: displayConfig.width,
        }),
        [activeFeatures, displayConfig, pruneState]
    );

    return state;
};

export default useExportState;
