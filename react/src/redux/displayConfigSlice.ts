import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getEntries } from '../util';
import type { RootState } from './store';

export interface TreeMetaData {
    leafCount: number;
    maxDistance: number;
    minDistance: number;
    minValue: number;
    maxValue: number;
    nodeCount: number;
}
export interface ToggleableDisplayElements {
    distanceVisible: boolean;
    nodeCountsVisible: boolean;
    nodeIdsVisible: boolean;
    piesVisible: boolean;
    showFeatureOpacity: boolean;
    strokeVisible: boolean;
}

export type ColorScaleVariant = 'labelCount' | 'featureHiLos' | 'featureCount';

export interface ColorScaleConfig {
    //the base color for the gradient scale
    featureColorBase: string;
    //average feature counts for each node
    featureColorDomain: number[];
    //the two-color range to interpolate between
    featureColorRange: string[];
    featureThresholdDomain: string[];
    featureThresholdRange: string[];
    featureThresholds: Record<string, number>;
    labelDomain: string[];
    labelRange: string[];
    variant: ColorScaleVariant;
}

export interface LinearScaleConfig {
    domain: [number, number];
    range: [number, number];
}

export interface Scales {
    branchSizeScale: LinearScaleConfig;
    colorScale: ColorScaleConfig;
    pieScale: LinearScaleConfig;
}

interface DisplayConfigState {
    scales: Scales;
    toggleableDisplayElements: ToggleableDisplayElements;
    treeMetadata: TreeMetaData;
    width: number;
}

const initialScales: Scales = {
    branchSizeScale: {
        domain: [0, 0],
        range: [0, 0],
    },
    colorScale: {
        featureColorDomain: [],
        featureColorRange: [],
        featureColorBase: '#E41A1C',
        featureThresholdDomain: [],
        featureThresholdRange: [],
        featureThresholds: {},
        labelDomain: [],
        labelRange: [],
        variant: 'labelCount',
    },
    pieScale: {
        domain: [0, 0],
        range: [0, 0],
    },
};

const initialToggleableValues: ToggleableDisplayElements = {
    distanceVisible: false,
    nodeCountsVisible: false,
    nodeIdsVisible: false,
    piesVisible: true,
    showFeatureOpacity: false,
    strokeVisible: false,
};

const initialState: DisplayConfigState = {
    scales: initialScales,
    toggleableDisplayElements: initialToggleableValues,
    treeMetadata: {} as TreeMetaData,
    width: 1000,
};

type PartialLinearScale = Partial<{
    [K in keyof Omit<Scales, 'colorScale'>]: Partial<Scales[K]>;
}>;

export const displayConfigSlice = createSlice({
    name: 'displayConfig',
    initialState,
    reducers: {
        activateFeatureColorScale: state => {
            state.scales.colorScale.featureColorRange = [
                '#D3D3D3',
                state.scales.colorScale.featureColorBase,
            ];
            state.scales.colorScale.variant = 'featureCount';
        },
        toggleDisplayProperty: (
            state,
            { payload }: PayloadAction<keyof ToggleableDisplayElements>
        ) => {
            state.toggleableDisplayElements[payload] =
                !state.toggleableDisplayElements[payload];
        },
        /* this is used by legend to blindly update colors for label and hi/lo scales */
        updateActiveOrdinalColorScale: (
            state,
            {
                payload: { domain, range },
            }: PayloadAction<{ domain: string[]; range: string[] }>
        ) => {
            const { variant } = state.scales.colorScale;

            if (variant === 'labelCount') {
                state.scales.colorScale.labelDomain = domain;
                state.scales.colorScale.labelRange = range;
            } else {
                state.scales.colorScale.featureThresholdDomain = domain;
                state.scales.colorScale.featureThresholdRange = range;
            }
        },
        updateColorScale: (
            state,
            { payload }: PayloadAction<Partial<Scales['colorScale']>>
        ) => {
            state.scales.colorScale = {
                ...state.scales.colorScale,
                ...payload,
            };
        },
        updateColorScaleThresholds: (
            state,
            { payload }: PayloadAction<Record<string, number>>
        ) => {
            state.scales.colorScale.featureThresholds = {
                ...state.scales.colorScale.featureThresholds,
                ...payload,
            };
        },
        updateColorScaleType: (
            state,
            { payload }: PayloadAction<ColorScaleVariant>
        ) => {
            state.scales.colorScale.variant = payload;
        },
        updateLinearScale: (
            state,
            { payload }: PayloadAction<PartialLinearScale>
        ) => {
            getEntries(payload).map(([k, v]) => {
                state.scales[k] = {
                    ...state.scales[k],
                    ...v,
                };
            });
        },
        updateTreeMetadata: (
            state,
            { payload }: PayloadAction<TreeMetaData>
        ) => {
            state.treeMetadata = payload;
        },
    },
});

export const {
    activateFeatureColorScale,
    toggleDisplayProperty,
    updateActiveOrdinalColorScale,
    updateColorScaleThresholds,
    updateColorScale,
    updateColorScaleType,
    updateLinearScale,
    updateTreeMetadata,
} = displayConfigSlice.actions;

export const selectToggleableDisplayElements = (state: RootState) =>
    state.displayConfig.toggleableDisplayElements;

export const selectScales = (state: RootState) => state.displayConfig.scales;

export const selectWidth = (state: RootState) => state.displayConfig.width;

export const selectTreeMetadata = (state: RootState) =>
    state.displayConfig.treeMetadata;

export default displayConfigSlice.reducer;
