import { useMemo } from 'react';
import { min, range as d3Range } from 'd3-array';
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
    const {
        featureDomain,
        featureRange,
        featureVariant,
        labelDomain,
        labelRange,
        variant,
    } = useAppSelector(selectScales)['colorScale'];

    /* select the appropriate range and domain */
    const [domain, range] = useMemo(() => {
        return variant === 'labelCount'
            ? [labelDomain, labelRange]
            : [featureDomain, featureRange.slice()];
    }, [variant, featureDomain, featureRange, labelRange, labelDomain]);

    const scale = useMemo(() => {
        return variant == 'featureCount'
            ? buildThresholdScale(
                  domain as number[],
                  range as [string, string],
                  featureVariant
              )
            : scaleOrdinal(range);
    }, [variant, featureVariant, domain, range]);

    return useMemo(() => {
        if (variant === 'featureCount') {
            scale as ScaleThreshold<any, any>;
        } else scale.domain(domain as string[]);
        return scale;
    }, [domain, range, variant, featureVariant]);
};

/**
 *
 * @param domain
 * @param _range expected to be 2 colors
 * @returns threshold scale that bins input values by nearest (down-rounding) power of 2 and returns a corresponding value in the output range
 */
const buildThresholdScale = (
    domain: number[],
    _range: [string, string],
    featureVariant: 'opacity' | 'two-color'
) => {
    const scaledDomain = [];

    const BASE = 2;

    const start = min(domain) || 0;

    let e = 0;

    while (e ** 2 < start) {
        e++;
    }
    scaledDomain.push(e);

    let i = 0;
    while (i < domain[1]) {
        if (BASE ** e < domain[1]) {
            e++;
            scaledDomain.push(BASE ** e);
        }
        i++;
    }

    const interpolator = interpolateRgb(..._range);

    const t = scaleThreshold(
        scaledDomain,
        // we want some minimal opacity
        d3Range(
            featureVariant === 'opacity' ? 0.05 : 0,
            1 + 1 / scaledDomain.length,
            1 / scaledDomain.length
        ).map(s => interpolator(s))
    );

    return t;
};
