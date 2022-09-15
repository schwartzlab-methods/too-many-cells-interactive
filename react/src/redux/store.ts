import { configureStore } from '@reduxjs/toolkit';
import displayConfigReducer from './displayConfigSlice';
import pruneSliceReducer from './pruneSlice';
import annotationSliceReducer from './annotationSlice';

const store = configureStore({
    reducer: {
        displayConfig: displayConfigReducer,
        annotationSlice: annotationSliceReducer,
        pruneSlice: pruneSliceReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
