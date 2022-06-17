import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export interface FeatureDistribution {
    mad: number;
    madWithZeroes: number;
    max: number;
    min: number;
    median: number;
    medianWithZeroes: number;
    total: number;
}

interface FeatureSliceState {
    activeFeatures: string[];
    featureDistributions: Record<string, FeatureDistribution>;
    featureMaps: Record<string, Record<string, number>>;
}

const initialState: FeatureSliceState = {
    activeFeatures: [],
    featureDistributions: {},
    featureMaps: {},
};

export const expressionSlice = createSlice({
    name: 'expressionSlice',
    initialState,
    reducers: {
        addFeature: (
            state,
            {
                payload: { key, map },
            }: PayloadAction<{ key: string; map: Record<string, number> }>
        ) => {
            state.featureMaps[key] = map;
            state.activeFeatures.push(key);
        },
        clearFeatureMaps: state => {
            state.featureMaps = {};
        },
        clearActiveFeatures: state => {
            state.activeFeatures = [];
        },
        removeActiveFeature: (state, { payload }: PayloadAction<string>) => {
            state.activeFeatures = state.activeFeatures.filter(
                f => f !== payload
            );
        },
        updateFeatureDistributions: (
            state,
            { payload }: PayloadAction<Record<string, FeatureDistribution>>
        ) => {
            state.featureDistributions = {
                ...state.featureDistributions,
                ...payload,
            };
        },
    },
});

export const {
    addFeature,
    clearActiveFeatures,
    clearFeatureMaps,
    removeActiveFeature,
    updateFeatureDistributions,
} = expressionSlice.actions;

export const selectFeatureSlice = (state: RootState) => state.featureSlice;

export default expressionSlice.reducer;
