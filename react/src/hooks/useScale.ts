import { useMemo } from 'react';
import { min, range as d3Range, sum } from 'd3-array';
import { color, rgb } from 'd3-color';
import { interpolateRgb } from 'd3-interpolate';
import {
    ScaleLinear,
    scaleLinear,
    ScaleOrdinal,
    scaleOrdinal,
    ScaleThreshold,
    scaleThreshold,
} from 'd3-scale';
import {
    ColorScaleVariant,
    Scales,
    selectDisplayConfig,
} from '../redux/displayConfigSlice';
import { AttributeMap, TMCHiearchyNode } from '../types';
import { selectFeatureSlice } from '../redux/featureSlice';
import { useAppSelector } from './index';

type ScaleType = {
    branchSizeScale: ScaleLinear<number, number>;
    pieScale: ScaleLinear<number, number>;
};

/**
 * @param scaleName The name of the linear scale to return (e.g., branchSizeScale, pieScale)
 */
export const useLinearScale = <K extends keyof Omit<Scales, 'colorScale'>>(
    scaleName: K
) => {
    const { domain, range } =
        useAppSelector(selectDisplayConfig)['scales'][scaleName];
    return useMemo(() => {
        return makeLinearScale(range, domain);
    }, [domain, range]) as ScaleType[K];
};

/* Wrap for export to server-side code */
export const makeLinearScale = (
    range: [number, number],
    domain: [number, number]
) => scaleLinear().range(range).domain(domain).clamp(true);

/* Wrap for export to server-side code */
export const makeOrdinalScale = (range: string[], domain: string[]) =>
    scaleOrdinal().range(range).domain(domain) as ScaleOrdinal<string, string>;

export const useColorScale = (): {
    scale: ScaleOrdinal<string, string> | ScaleThreshold<any, any>;
    scaleFunction: (node: TMCHiearchyNode) => string;
} => {
    const {
        scales: {
            colorScale: {
                featureGradientColor,
                featureGradientDomain,
                featureGradientRange,
                featureHiLoDomain,
                featureHiLoRange,
                labelDomain,
                labelRange,
                variant,
            },
        },
        toggleableFeatures: { showFeatureOpacity },
    } = useAppSelector(selectDisplayConfig);

    const { activeFeatures } = useAppSelector(selectFeatureSlice);

    /* define the color scales */

    const featureLinearScale = useMemo(() => {
        return buildFeatureLinearScale(featureGradientDomain);
    }, [featureGradientDomain]);

    const featureColorScale = useMemo(() => {
        return buildFeatureColorScale(
            featureGradientRange[0],
            featureGradientColor,
            featureLinearScale
        );
    }, [featureGradientColor, featureGradientRange, featureLinearScale]);

    const featureHiLoScale = useMemo(() => {
        return makeOrdinalScale(featureHiLoRange, featureHiLoDomain);
    }, [featureHiLoDomain, featureHiLoRange]);

    const labelScale = useMemo(() => {
        return makeOrdinalScale(labelRange, labelDomain);
    }, [labelDomain, labelRange]);

    /* return the active scale with wrapper function to handle node-level blending/opacity logic */
    return useMemo(
        () =>
            makeColorScale(
                activeFeatures,
                featureColorScale,
                featureHiLoScale,
                featureLinearScale,
                labelScale,
                showFeatureOpacity,
                variant
            ),
        [
            activeFeatures,
            featureColorScale,
            featureHiLoScale,
            featureLinearScale,
            labelScale,
            showFeatureOpacity,
            variant,
        ]
    );
};

export const buildFeatureColorScale = (
    colorStart: string,
    colorEnd: string,
    opacityScale: ScaleThreshold<number, number>
) => {
    const interpolator = interpolateRgb(colorStart, colorEnd);
    return scaleThreshold<number, string>()
        .domain(opacityScale.domain().slice())
        .range(opacityScale.range().map(v => interpolator(v)));
};

export const makeColorScale = (
    activeFeatures: string[],
    featureColorScale: ScaleThreshold<number, string>,
    featureHiLoScale: ScaleOrdinal<string, string>,
    featureLinearScale: ScaleThreshold<number, number>,
    labelScale: ScaleOrdinal<string, string>,
    showFeatureOpacity: boolean,
    variant: ColorScaleVariant
) => {
    let scale: ScaleOrdinal<string, string> | ScaleThreshold<number, string>;
    let scaleFunction: (node: TMCHiearchyNode) => string;
    switch (variant) {
        case 'labelCount':
            scale = labelScale;
            scaleFunction = buildLabelColorFunction(
                activeFeatures,
                labelScale,
                showFeatureOpacity,
                featureLinearScale
            );
            break;
        case 'featureCount':
            scale = featureColorScale;
            scaleFunction = (node: TMCHiearchyNode) => {
                const featureAverage = getFeatureAverage(node, activeFeatures);
                return featureColorScale(featureAverage);
            };
            break;

        case 'featureHiLos':
            scale = featureHiLoScale;
            scaleFunction = (node: TMCHiearchyNode) => {
                return getLabelColor(
                    featureHiLoScale,
                    node,
                    'featureHiLos'
                ).toString();
            };
            break;
    }
    return { scaleFunction, scale };
};

export const getFeatureAverage = (
    node: TMCHiearchyNode,
    activeFeatures: string[]
) =>
    sum(
        Object.entries(node.data.featureCount)
            .filter(([k, v]) => activeFeatures.includes(k))
            //`quantity` is raw value, scaleKey is divided by descendant count
            .flatMap(([k, v]) => v.scaleKey as number)
    ) / activeFeatures.length;

export const buildLabelColorFunction = (
    activeFeatures: string[],
    labelScale: ScaleOrdinal<string, string>,
    showFeatureOpacity = false,
    featureLinearScale?: ScaleThreshold<number, number, never>
): ((node: TMCHiearchyNode) => string) => {
    return (node: TMCHiearchyNode) => {
        const color = getLabelColor(labelScale, node, 'labelCount');
        if (showFeatureOpacity && featureLinearScale) {
            const featureAverage = getFeatureAverage(node, activeFeatures);
            color.opacity = featureLinearScale(featureAverage);
        } else color.opacity = 1;

        return color.toString();
    };
};

const blendWeighted = (colors: BlendArg[]) => {
    const { r, b, g } = colors.reduce(
        (acc, curr) => {
            const { r, g, b } = curr.color
                ? color(curr.color)!.rgb()
                : { r: 0, g: 0, b: 0 };
            acc.r += r * curr.weight;
            acc.g += g * curr.weight;
            acc.b += b * curr.weight;
            return acc;
        },
        { r: 0, g: 0, b: 0 }
    );
    const weightSum = colors.reduce((acc, curr) => (acc += curr.weight), 0);

    return rgb(r / weightSum, g / weightSum, b / weightSum);
};

type BlendArg = { color: string; weight: number };

export function getLabelColor(
    scale: ScaleOrdinal<string, string>,
    node: TMCHiearchyNode,
    colorSource: 'featureHiLos' | 'labelCount'
) {
    const blendValues = node.data[colorSource];

    return getBlendedColor(blendValues, scale);
}

export const getBlendedColor = (
    counts: AttributeMap,
    scale: ScaleOrdinal<string, string> | ScaleThreshold<any, any>
) => {
    const weightedColors = Object.values(counts).map<BlendArg>(v => ({
        //it's possible for weight to be zero, in which case we'll get black, so well set at one
        weight: v.quantity || 1,
        color: scale(v.scaleKey as string),
    }));
    //rgb
    return blendWeighted(weightedColors);
};

/**
 *
 * @param domain all feature values (likely the average feature count of each node in the graphic)
 * @returns threshold scale that bins input values by nearest (down-rounding) power of 2 and returns a corresponding value between 0 and 1
 */
export const buildFeatureLinearScale = (domain: number[]) => {
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

    return scaleThreshold(
        scaledDomain,
        d3Range(0, 1 + 1 / scaledDomain.length, 1 / scaledDomain.length)
    );
};
