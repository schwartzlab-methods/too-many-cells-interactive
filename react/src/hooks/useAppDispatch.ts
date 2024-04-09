import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../redux/store';

/* Typescript wrapper for useDispatch */
const useAppDispatch: () => AppDispatch = useDispatch;

export default useAppDispatch;
