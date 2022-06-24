import { useMemo } from 'react';
import { ScaleLinear, scaleLinear, scaleLog, scaleOrdinal } from 'd3-scale';
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
    const { featureDomain, featureRange, labelDomain, labelRange, variant } =
        useAppSelector(selectScales)['colorScale'];

    /* select the appropriate range and domain */
    const [domain, range] = useMemo(() => {
        return variant === 'labelCount'
            ? [labelDomain, labelRange]
            : [featureDomain, featureRange.slice()];
    }, [variant, featureDomain, featureRange, labelRange, labelDomain]);

    const scale =
        variant == 'featureCount'
            ? scaleLog<any, any>(range)
            : scaleOrdinal(range);

    return useMemo(() => {
        if (variant === 'featureCount') {
            (scale as ScaleLinear<any, any>).domain(domain as number[]);
        } else scale.domain(domain as string[]);
        return scale;
    }, [domain, range, variant]);
};
