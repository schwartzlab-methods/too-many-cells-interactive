import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { FeatureMap } from '../types';
import { getKeys } from '../util';
import { DistributionMetadata } from './pruneSlice';
import type { RootState } from './store';

export interface FeatureDistribution extends DistributionMetadata {
    madWithZeroes: number;
    max: number;
    min: number;
    medianWithZeroes: number;
    total: number;
}

interface FeatureSliceState {
    activeFeatures: string[];
    featureDistributions: Record<string, FeatureDistribution>;
    featureMaps: FeatureMap;
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
        addFeatures: (state, { payload: map }: PayloadAction<FeatureMap>) => {
            state.featureMaps = map;
            state.activeFeatures = state.activeFeatures.concat(getKeys(map));
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
    addFeatures,
    clearActiveFeatures,
    clearFeatureMaps,
    removeActiveFeature,
    updateFeatureDistributions,
} = expressionSlice.actions;

export const selectFeatureSlice = (state: RootState) => state.featureSlice;

export default expressionSlice.reducer;
