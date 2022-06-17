import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export interface DistributionMetadata {
    mad: number;
    madGroups: Record<number, number>;
    median: number;
    plainGroups: Record<number, number>;
}

type DistributionKeys = 'distance' | 'distanceSearch' | 'size';

type DetailedDistributions = { [K in DistributionKeys]: DistributionMetadata };

export interface Distributions extends DetailedDistributions {
    depthGroups: Record<number, number>;
}

export type PruneHistory = PruneStep[];

interface PruneSliceState {
    currentPruneStep: number;
    distributionMetadata: Distributions;
    pruneHistory: PruneHistory;
}

const makeFreshPruneStep = () => ({
    clickPruneHistory: [],
    valuePruner: {},
});

const initialState: PruneSliceState = {
    currentPruneStep: 0,
    distributionMetadata: {
        depthGroups: {},
        distance: {} as DistributionMetadata,
        distanceSearch: {} as DistributionMetadata,
        size: {} as DistributionMetadata,
    },
    pruneHistory: [makeFreshPruneStep()],
};

export type ValuePruneType =
    | 'minSize'
    | 'minDistance'
    | 'minDistanceSearch'
    | 'minDepth';

export type ClickPruneType = 'setRootNode' | 'setCollapsedNode';

type AllPruneType = ValuePruneType | ClickPruneType;

interface Pruner<T> {
    key?: T;
}

export interface ClickPruner extends Pruner<ClickPruneType> {
    value?: string;
}

export interface ValuePruner extends Pruner<ValuePruneType> {
    value?: number;
}

export interface AllPruner extends Pruner<AllPruneType> {
    value?: string | number;
}

export interface PruneStep {
    valuePruner: ValuePruner;
    clickPruneHistory: ClickPruner[];
}

export const pruneSlice = createSlice({
    name: 'pruneState',
    initialState,
    reducers: {
        addClickPrune: (
            { currentPruneStep, pruneHistory },
            { payload }: PayloadAction<ClickPruner>
        ) => {
            pruneHistory[currentPruneStep].clickPruneHistory = [
                ...pruneHistory[currentPruneStep].clickPruneHistory,
                payload,
            ];
        },
        addStep: state => {
            state.pruneHistory = state.pruneHistory.concat(
                makeFreshPruneStep()
            );
            state.currentPruneStep += 1;
        },
        addValuePrune: (
            { currentPruneStep, pruneHistory },
            { payload }: PayloadAction<ValuePruner>
        ) => {
            pruneHistory[currentPruneStep].valuePruner = payload;
            pruneHistory[currentPruneStep].clickPruneHistory = [];
        },
        removeClickPrune: (
            { currentPruneStep, pruneHistory },
            { payload: { key, value } }: PayloadAction<ClickPruner>
        ) => {
            pruneHistory[currentPruneStep].clickPruneHistory = pruneHistory[
                currentPruneStep
            ].clickPruneHistory.filter(h => h.key !== key && h.value === value);
        },
        resetHistory: state => {
            state.currentPruneStep = 0;
            state.pruneHistory = [makeFreshPruneStep()];
        },
        revertToStep: (state, { payload }: PayloadAction<number>) => {
            state.currentPruneStep = payload;
        },
        updateActiveStep: (state, { payload }: PayloadAction<number>) => {
            state.currentPruneStep = payload;
        },
        updateDistributions: (
            state,
            { payload }: PayloadAction<Distributions>
        ) => {
            state.distributionMetadata = payload;
        },
    },
});

export const {
    addClickPrune,
    addStep,
    addValuePrune,
    removeClickPrune,
    resetHistory,
    revertToStep,
    updateDistributions,
} = pruneSlice.actions;

export const selectActivePruneStep = (state: RootState) => ({
    step: state.pruneSlice.pruneHistory[state.pruneSlice.currentPruneStep],
    index: state.pruneSlice.currentPruneStep,
});

export const selectDistributionMetadata = (state: RootState) =>
    state.pruneSlice.distributionMetadata;

export const selectPruneHistory = (state: RootState) =>
    state.pruneSlice.pruneHistory;

export default pruneSlice.reducer;
