import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

interface DistributionMetadata {
    mad: number;
    madGroups: Map<any, any>;
    median: number;
    plainGroups: Map<any, any>;
}

type DistributionKeys = 'distance' | 'distanceSearch' | 'size';

export type Distributions = { [K in DistributionKeys]: DistributionMetadata };

interface PruneSliceState {
    currentPruneStep: number;
    distributionMetadata: Distributions;
    pruneHistory: PruneStep[];
}

const makeFreshPruneStep = () => ({
    clickPruneHistory: [],
    valuePruner: {},
});

const initialState: PruneSliceState = {
    //todo: each prunestep could have its own metadata on it, including tree metadata?
    currentPruneStep: 0,
    distributionMetadata: {
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
        addValuePrune: (
            { currentPruneStep, pruneHistory },
            { payload }: PayloadAction<ValuePruner>
        ) => {
            pruneHistory[currentPruneStep].valuePruner = payload;
            pruneHistory[currentPruneStep].clickPruneHistory = [];
        },
        addStep: state => {
            state.pruneHistory.push(makeFreshPruneStep());
            state.currentPruneStep += 1;
        },
        removeClickPrune: (
            { currentPruneStep, pruneHistory },
            { payload }: PayloadAction<string>
        ) => {
            pruneHistory[currentPruneStep].clickPruneHistory.filter(
                h => h.key !== payload
            );
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

export const { addStep, updateDistributions } = pruneSlice.actions;

export const selectActivePruneStep = (state: RootState) => ({
    step: state.pruneSlice.pruneHistory[state.pruneSlice.currentPruneStep],
    index: state.pruneSlice.currentPruneStep,
});

export const selectPruneHistory = (state: RootState) =>
    state.pruneSlice.pruneHistory[state.pruneSlice.currentPruneStep];

export default pruneSlice.reducer;
