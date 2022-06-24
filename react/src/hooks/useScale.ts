import { useMemo } from 'react';
import { range as d3Range } from 'd3-array';
import { interpolateRgb } from 'd3-interpolate';
import {
    ScaleLinear,
    scaleLinear,
    scaleOrdinal,
    ScaleThreshold,
    scaleThreshold,
} from 'd3-scale';
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
            ? buildThresholdScale(domain as number[], range as [string, string])
            : scaleOrdinal(range);

    return useMemo(() => {
        if (variant === 'featureCount') {
            scale as ScaleThreshold<any, any>;
        } else scale.domain(domain as string[]);
        return scale;
    }, [domain, range, variant]);
};

/**
 *
 * @param domain
 * @param _range expected to be 2 colors
 * @returns threshold scale that bins input values by nearest (down-rounding) power of 2 and returns a corresponding value in the output range
 */
const buildThresholdScale = (domain: number[], _range: [string, string]) => {
    const scaledDomain = [0];

    const BASE = 2;

    let i = 0,
        j = 0;
    while (i < domain[1]) {
        if (BASE ** j < domain[1]) {
            j++;
            scaledDomain.push(BASE ** j);
        }
        i++;
    }

    const interpolator = interpolateRgb(..._range);

    const t = scaleThreshold(
        scaledDomain,
        d3Range(0.05, 1 + 1 / scaledDomain.length, 1 / scaledDomain.length).map(
            s => interpolator(s)
        )
    );

    return t;
};
