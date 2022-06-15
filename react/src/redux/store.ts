import { configureStore } from '@reduxjs/toolkit';
import displayConfigReducer from './displayConfigSlice';

const store = configureStore({
    reducer: {
        displayConfig: displayConfigReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
