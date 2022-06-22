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
    piesVisible: boolean;
    strokeVisible: boolean;
    nodeIdsVisible: boolean;
    nodeCountsVisible: boolean;
    distanceVisible: boolean;
}

export type ColorScaleVariant = 'labelCount' | 'featureHiLos' | 'featureCount';

export interface ColorScaleConfig {
    featureDomain: string[] | number[];
    featureRange: string[];
    labelDomain: string[];
    labelRange: string[];
    featureThresholds: Record<string, number>;
    featureVariant: 'two-color' | 'opacity';
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
        featureThresholds: {},
        featureDomain: [''],
        featureRange: [''],
        labelDomain: [''],
        labelRange: [''],
        variant: 'labelCount',
        featureVariant: 'two-color',
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
        activateContinuousFeatureScale: (
            state,
            {
                payload: { max, variant },
            }: PayloadAction<{ max: number; variant: 'opacity' | 'two-color' }>
        ) => {
            state.scales.colorScale.featureDomain = [0, max];
            state.scales.colorScale.featureVariant = variant;
            state.scales.colorScale.featureRange =
                variant === 'opacity'
                    ? ['#D3D3D3', '#E41A1C']
                    : ['rgba(228,26,28,0)', 'rgba(228,26,28,1)'];
            state.scales.colorScale.variant = 'featureCount';
        },
        toggleDisplayProperty: (
            state,
            { payload }: PayloadAction<keyof ToggleableDisplayElements>
        ) => {
            state.toggleableDisplayElements[payload] =
                !state.toggleableDisplayElements[payload];
        },
        /* this is mainly used by legend to blindly update colors */
        updateColorScale: (
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
                state.scales.colorScale.featureDomain = domain;
                state.scales.colorScale.featureRange = range;
            }
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
    activateContinuousFeatureScale,
    toggleDisplayProperty,
    updateColorScale,
    updateColorScaleThresholds,
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
