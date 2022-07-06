import { configureStore } from '@reduxjs/toolkit';
import displayConfigReducer from './displayConfigSlice';
import pruneSliceReducer from './pruneSlice';
import featureSliceReducer from './featureSlice';

const store = configureStore({
    reducer: {
        displayConfig: displayConfigReducer,
        featureSlice: featureSliceReducer,
        pruneSlice: pruneSliceReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
