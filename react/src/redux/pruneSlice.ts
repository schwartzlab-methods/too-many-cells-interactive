import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PlainOrMADVal, ValueDisplayUnits } from '../types';
import { CumSumBin } from '../Visualizations/AreaChart';
import type { RootState } from './store';

export interface DistributionMetadata {
    mad: number;
    madGroups: CumSumBin[];
    median: number;
    plainGroups: CumSumBin[];
}

type DistributionKeys = 'distance' | 'distanceSearch' | 'size';

type DetailedDistributions = { [K in DistributionKeys]: DistributionMetadata };

export interface Distributions extends DetailedDistributions {
    depthGroups: CumSumBin[];
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
        depthGroups: [],
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
    | 'maxDepth';

export type ClickPruneType = 'setRootNode' | 'setCollapsedNode';

type AllPruneType = ValuePruneType | ClickPruneType;

/* A new prune step will be an empty object to be populated by UI controls
    Display type stored on pruner mainly for convenience
*/
interface Pruner<T> {
    name?: T;
    displayValue?: ValueDisplayUnits;
}

interface ClickPrunerVal {
    plainValue: string;
}

export interface ClickPruner extends Pruner<ClickPruneType> {
    value?: ClickPrunerVal;
}

export interface ValuePruner extends Pruner<ValuePruneType> {
    value?: PlainOrMADVal;
}

export interface AllPruner extends Pruner<AllPruneType> {
    value?: PlainOrMADVal | ClickPrunerVal;
}

export interface PruneStep {
    valuePruner: ValuePruner;
    clickPruneHistory: ClickPruner[];
}

/* Slice of the store than handles pruning state */
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
            //if we're at an intermediate step, we need to clean out the subsequent steps
            const newHistory = state.pruneHistory.slice(
                0,
                state.currentPruneStep + 1
            );
            state.pruneHistory = newHistory.concat(makeFreshPruneStep());
            state.currentPruneStep += 1;
        },
        addValuePrune: (
            { currentPruneStep, pruneHistory },
            { payload }: PayloadAction<ValuePruner>
        ) => {
            pruneHistory[currentPruneStep].valuePruner = {
                ...pruneHistory[currentPruneStep].valuePruner,
                ...payload,
            };
            //always wipe out uncommitted click prunes
            pruneHistory[currentPruneStep].clickPruneHistory = [];
        },
        removeClickPrune: (
            { currentPruneStep, pruneHistory },
            { payload: { name, value } }: PayloadAction<ClickPruner>
        ) => {
            pruneHistory[currentPruneStep].clickPruneHistory = pruneHistory[
                currentPruneStep
            ].clickPruneHistory.filter(
                h => h.name !== name && h.value === value
            );
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
        updatePruneValueDisplayType: (
            { pruneHistory, currentPruneStep },
            { payload }: PayloadAction<ValueDisplayUnits>
        ) => {
            pruneHistory[currentPruneStep].valuePruner.displayValue = payload;
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
    updatePruneValueDisplayType,
} = pruneSlice.actions;

export const selectActivePruneStep = (state: RootState) => ({
    step: state.pruneSlice.pruneHistory[state.pruneSlice.currentPruneStep],
    index: state.pruneSlice.currentPruneStep,
});

export const selectPruneSlice = (state: RootState) => state.pruneSlice;

export default pruneSlice.reducer;
