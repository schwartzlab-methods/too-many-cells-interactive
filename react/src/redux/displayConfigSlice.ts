import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getEntries } from '../util';
import type { RootState } from './store';

export interface TreeMetaData {
    leafCount: number;
    maxDistance: number;
    maxValue: number;
    minDistance: number;
    minValue: number;
    nodeCount: number;
}
export interface ToggleableDisplayElements {
    distanceVisible: boolean;
    nodeCountsVisible: boolean;
    nodeIdsVisible: boolean;
    piesVisible: boolean;
    strokeVisible: boolean;
}

export type ColorScaleVariant = 'labelCount' | 'featureHiLos' | 'featureCount';

export interface ColorScaleConfig {
    //the base color for the gradient scale
    featureGradientColor: string;
    //average feature counts for each node
    featureGradientDomain: number[];
    //the two-color range to interpolate between
    featureGradientRange: string[];
    featureHiLoDomain: string[];
    featureHiLoRange: string[];
    featureHiLoThresholds: Record<string, number>;
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

export interface DisplayConfigState {
    containerClassName: string;
    scales: Scales;
    toggleableFeatures: ToggleableDisplayElements;
    treeMetadata: TreeMetaData;
    width: number;
}

const initialScales: Scales = {
    branchSizeScale: {
        domain: [0, 0],
        range: [0, 0],
    },
    colorScale: {
        featureGradientDomain: [],
        featureGradientRange: [],
        featureGradientColor: '#E41A1C',
        featureHiLoDomain: [],
        featureHiLoRange: [],
        featureHiLoThresholds: {},
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
    strokeVisible: false,
};

const initialState: DisplayConfigState = {
    containerClassName: `tree-${Math.random().toString(36).slice(2)}`,
    scales: initialScales,
    toggleableFeatures: initialToggleableValues,
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
            state.scales.colorScale.featureGradientRange = [
                '#D3D3D3',
                state.scales.colorScale.featureGradientColor,
            ];
            state.scales.colorScale.variant = 'featureCount';
        },
        toggleDisplayProperty: (
            state,
            { payload }: PayloadAction<keyof ToggleableDisplayElements>
        ) => {
            state.toggleableFeatures[payload] =
                !state.toggleableFeatures[payload];
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
                state.scales.colorScale.featureHiLoDomain = domain;
                state.scales.colorScale.featureHiLoRange = range;
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
            state.scales.colorScale.featureHiLoThresholds = {
                ...state.scales.colorScale.featureHiLoThresholds,
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

export const selectDisplayConfig = (state: RootState) => state.displayConfig;

export default displayConfigSlice.reducer;
