import { HierarchyNode } from 'd3-hierarchy';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { TMCNode } from '../types';
import type { RootState } from './store';

export interface ToggleableDisplayElements {
    piesVisible: boolean;
    strokeVisible: boolean;
    nodeIdsVisible: boolean;
    nodeCountsVisible: boolean;
    distanceVisible: boolean;
}

interface DisplayConfigState extends ToggleableDisplayElements {
    visibleNodes: HierarchyNode<TMCNode> | undefined;
}

const initialState: DisplayConfigState = {
    piesVisible: true,
    strokeVisible: false,
    nodeIdsVisible: false,
    nodeCountsVisible: false,
    distanceVisible: false,
    visibleNodes: undefined,
};

export const counterSlice = createSlice({
    name: 'displayConfig',
    initialState,
    reducers: {
        toggleDisplayProperty: (
            state,
            { payload }: PayloadAction<keyof ToggleableDisplayElements>
        ) => {
            state[payload] = !state[payload];
        },
        togglePiesVisible: state => {
            state.piesVisible = !state.piesVisible;
        },
    },
});

export const { togglePiesVisible, toggleDisplayProperty } =
    counterSlice.actions;

export const selectPiesVisible = (state: RootState) =>
    state.displayConfig.piesVisible;

export const selectToggleableDisplayElements = (state: RootState) =>
    state.displayConfig;

export const selectToggleableDisplayElement =
    (key: keyof ToggleableDisplayElements) => (state: RootState) =>
        state.displayConfig[key];

export default counterSlice.reducer;
