import { useMemo } from 'react';
import { extent, sum } from 'd3-array';
import { color, hsl, rgb } from 'd3-color';
import { interpolateHsl } from 'd3-interpolate';
import {
    scaleLinear,
    ScaleOrdinal,
    scaleOrdinal,
    ScaleLinear,
    scaleSequential,
    ScaleSequential,
    scaleSequentialSymlog,
} from 'd3-scale';
import {
    ColorScaleVariant,
    FeatureGradientScaleType,
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
export const makeOrdinalScale = (
    range: string[],
    domain: string[],
    saturation?: number
) => {
    let _range = range;
    if (saturation) {
        _range = range.map(r => {
            const _r = hsl(r);
            _r.s = saturation;
            return _r.formatHex();
        });
    }

    return scaleOrdinal().range(_range).domain(domain) as ScaleOrdinal<
        string,
        string
    >;
};

export const useColorScale = (): {
    scale: ScaleOrdinal<string, string> | ScaleSequential<string>;
    scaleFunction: (node: TMCHiearchyNode) => string;
} => {
    const {
        scales: {
            colorScale: {
                featureGradientColor,
                featureGradientDomain,
                featureGradientRange,
                featureGradientScaleType,
                featureScaleSaturation,
                featureHiLoDomain,
                featureHiLoRange,
                labelDomain,
                labelRange,
                variant,
            },
        },
    } = useAppSelector(selectDisplayConfig);

    const { activeFeatures } = useAppSelector(selectFeatureSlice);

    /* define the color scales */

    const featureColorScale = useMemo(() => {
        return buildFeatureColorScale(
            featureGradientRange[0],
            featureGradientColor,
            featureGradientScaleType,
            featureGradientDomain,
            featureScaleSaturation
        );
    }, [
        featureGradientColor,
        featureGradientDomain,
        featureGradientRange,
        featureGradientScaleType,
        featureScaleSaturation,
    ]);

    const featureHiLoScale = useMemo(() => {
        return makeOrdinalScale(
            featureHiLoRange,
            featureHiLoDomain,
            featureScaleSaturation
        );
    }, [featureHiLoDomain, featureHiLoRange, featureScaleSaturation]);

    const labelScale = useMemo(() => {
        return makeOrdinalScale(labelRange, labelDomain);
    }, [labelDomain, labelRange]);

    /* return the active scale with wrapper function to handle node-level blending logic */
    return useMemo(
        () =>
            makeColorScale(
                activeFeatures,
                featureColorScale,
                featureHiLoScale,
                labelScale,
                variant
            ),
        [
            activeFeatures,
            featureColorScale,
            featureHiLoScale,
            labelScale,
            variant,
        ]
    );
};

export const buildFeatureColorScale = (
    colorStart: string,
    colorEnd: string,
    scaleType: FeatureGradientScaleType,
    featureDomain: number[],
    saturation: number | undefined
) => {
    const scale =
        scaleType === 'sequential' ? scaleSequential : scaleSequentialSymlog;

    const end = hsl(colorEnd);
    if (saturation) {
        end.s = saturation;
    }

    //color must be hsl or s values will be clamped at 1
    return scale<string>(interpolateHsl(colorStart, end)).domain(
        extent(featureDomain) as [number, number]
    );
};

export const makeColorScale = (
    activeFeatures: string[],
    featureColorScale: ScaleSequential<string>,
    featureHiLoScale: ScaleOrdinal<string, string>,
    labelScale: ScaleOrdinal<string, string>,
    variant: ColorScaleVariant
) => {
    let scale: ScaleOrdinal<string, string> | ScaleSequential<string>;
    let scaleFunction: (node: TMCHiearchyNode) => string;
    switch (variant) {
        case 'labelCount':
            scale = labelScale;
            scaleFunction = buildLabelColorFunction(activeFeatures, labelScale);
            break;
        case 'featureAverage':
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
    labelScale: ScaleOrdinal<string, string>
): ((node: TMCHiearchyNode) => string) => {
    return (node: TMCHiearchyNode) => {
        const color = getLabelColor(labelScale, node, 'labelCount');
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
    scale: ScaleOrdinal<string, string> | ScaleLinear<any, any>
) => {
    const weightedColors = Object.values(counts).map<BlendArg>(v => ({
        //it's possible for weight to be zero, in which case we'll get black, so well set at one
        weight: v.quantity || 1,
        color: scale(v.scaleKey as any),
    }));
    //rgb
    return blendWeighted(weightedColors);
};
