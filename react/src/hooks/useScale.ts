import { useMemo } from 'react';
import { ScaleLinear, scaleLinear, ScaleOrdinal, scaleOrdinal } from 'd3-scale';
import { Scales, selectScales } from '../redux/displayConfigSlice';
import { useAppSelector } from './index';

type ScaleType = {
    branchSizeScale: ScaleLinear<number, number>;
    pieScale: ScaleLinear<number, number>;
};

export const useLinearScale = <K extends keyof Omit<Scales, 'colorScale'>>(
    scaleName: K
) => {
    const { domain, range } = useAppSelector(selectScales)[scaleName];
    return useMemo(() => {
        return scaleLinear().range(range).domain(domain).clamp(true);
    }, [domain, range]) as ScaleType[K];
};

export const useColorScale = () => {
    const { domain, range, variant } =
        useAppSelector(selectScales)['colorScale'];

    if (variant === 'featureCount') {
        const allLowIdx = domain.findIndex(item => !item.includes('high'));
        if (allLowIdx) {
            range[allLowIdx] = '#D3D3D3';
        }
    }

    return useMemo(() => {
        return scaleOrdinal().range(range).domain(domain) as ScaleOrdinal<
            string,
            string
        >;
    }, [domain, range]);
};
