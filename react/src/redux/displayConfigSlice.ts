import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getEntries } from '../util';
import type { RootState } from './store';

interface TreeMetaData {
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
    domain: string[];
    expressionThresholds: Record<string, number>;
    range: string[];
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
        domain: [''],
        expressionThresholds: {},
        range: [''],
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
        updateColorScale: (
            state,
            { payload }: PayloadAction<Partial<Scales['colorScale']>>
        ) => {
            state.scales.colorScale = {
                ...state.scales.colorScale,
                ...payload,
            };
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
    },
});

export const { toggleDisplayProperty, updateColorScale, updateLinearScale } =
    displayConfigSlice.actions;

export const selectToggleableDisplayElements = (state: RootState) =>
    state.displayConfig.toggleableDisplayElements;

export const selectScales = (state: RootState) => state.displayConfig.scales;

export const selectWidth = (state: RootState) => state.displayConfig.width;

export default displayConfigSlice.reducer;
