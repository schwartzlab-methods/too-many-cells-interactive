import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AttributeMap, FeatureMap } from '../types';
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

interface AnnotationSliceState {
    activeFeatures: string[];
    featureDistributions: Record<string, FeatureDistribution>;
    featureMaps: FeatureMap;
    userAnnoationMap: AttributeMap;
}

const initialState: AnnotationSliceState = {
    activeFeatures: [],
    featureDistributions: {},
    featureMaps: {},
    userAnnoationMap: {},
};

export const annotationSlice = createSlice({
    name: 'annotationSlice',
    initialState,
    reducers: {
        addFeatures: (state, { payload: map }: PayloadAction<FeatureMap>) => {
            state.featureMaps = map;
            state.activeFeatures = state.activeFeatures.concat(getKeys(map));
        },
        addUserAnnotation: (
            state,
            { payload: map }: PayloadAction<AttributeMap>
        ) => {
            state.userAnnoationMap = map;
        },
        clearFeatureMaps: state => {
            state.featureMaps = {};
        },
        clearUserAnnotationMaps: state => {
            state.userAnnoationMap = {};
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
    addUserAnnotation,
    clearActiveFeatures,
    clearFeatureMaps,
    clearUserAnnotationMaps,
    removeActiveFeature,
    updateFeatureDistributions,
} = annotationSlice.actions;

export const selectAnnotationSlice = (state: RootState) =>
    state.annotationSlice;

export default annotationSlice.reducer;
