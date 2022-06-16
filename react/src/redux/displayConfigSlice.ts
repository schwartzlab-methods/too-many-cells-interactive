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

export interface ColorScaleConfig {
    featureDomain: string[];
    featureRange: string[];
    labelDomain: string[];
    labelRange: string[];
    expressionThresholds: Record<string, number>;
    variant: 'labelCount' | 'featureCount';
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
        expressionThresholds: {},
        featureDomain: [''],
        featureRange: [''],
        labelDomain: [''],
        labelRange: [''],
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

            if (variant === 'featureCount') {
                state.scales.colorScale.featureDomain = domain;
                state.scales.colorScale.featureRange = range;
            } else {
                state.scales.colorScale.labelDomain = domain;
                state.scales.colorScale.labelRange = range;
            }
        },
        updateColorScaleThresholds: (
            state,
            { payload }: PayloadAction<Record<string, number>>
        ) => {
            state.scales.colorScale.expressionThresholds = {
                ...state.scales.colorScale.expressionThresholds,
                ...payload,
            };
        },
        updateColorScaleType: (
            state,
            { payload }: PayloadAction<'featureCount' | 'labelCount'>
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
