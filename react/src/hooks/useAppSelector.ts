import { TypedUseSelectorHook, useSelector } from 'react-redux';
import type { RootState } from '../redux/store';

/* Typescript wrapper for useSelector */
const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export default useAppSelector;
