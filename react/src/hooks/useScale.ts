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
import { getEntries, getKeys } from '../util';
import { selectAnnotationSlice } from '../redux/annotationSlice';
import { useAppSelector } from './index';

type ScaleType = {
    branchSizeScale: ScaleLinear<number, number>;
    pieScale: ScaleLinear<number, number>;
};

/**
 * Build linear scale according to display config.
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

/**
 * Build the active scale according to the configuration and return.
 * @returns Object with the scale and a function that takes a node and returns the color.
 */
export const useColorScale = (): {
    scale:
        | ScaleOrdinal<string, string>
        | ScaleSequential<string>
        | Record<string, ScaleSequential<string>>;
    scaleFunction: (node: TMCHiearchyNode) => string;
} => {
    const {
        scales: {
            colorScale: {
                featureGradientDomain,
                featureGradientRange,
                featureGradientScaleType,
                featureScaleSaturation,
                featureHiLoDomain,
                featureHiLoRange,
                featuresGradientDomains,
                featuresGradientRanges,
                labelDomain,
                labelRange,
                userAnnotationDomain,
                userAnnotationRange,
                variant,
            },
        },
    } = useAppSelector(selectDisplayConfig);

    const { activeFeatures } = useAppSelector(selectAnnotationSlice);

    /* define the color scales */

    const featureColorScale = useMemo(() => {
        return buildSequentialScale(
            featureGradientRange,
            featureGradientDomain,
            featureScaleSaturation,
            featureGradientScaleType
        );
    }, [
        featureGradientDomain,
        featureGradientRange,
        featureGradientScaleType,
        featureScaleSaturation,
    ]);

    const individualFeaturesColorScales = useMemo(() => {
        return getKeys(featuresGradientRanges)
            .map(n => ({
                [n]: buildSequentialScale(
                    featuresGradientRanges[n],
                    featuresGradientDomains[n],
                    featureScaleSaturation
                ),
            }))
            .reduce<Record<string, ScaleSequential<string, never>>>(
                (acc, curr) => ({ ...acc, ...curr }),
                {}
            );
    }, [
        featuresGradientDomains,
        featuresGradientRanges,
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

    const userAnnotationScale = useMemo(() => {
        return buildSequentialScale(
            userAnnotationRange,
            userAnnotationDomain,
            featureScaleSaturation
        );
    }, [userAnnotationDomain, userAnnotationRange, featureScaleSaturation]);

    /* return the active scale with wrapper function to handle node-level blending logic */
    return useMemo(
        () =>
            makeColorScale(
                activeFeatures,
                featureColorScale,
                featureHiLoScale,
                individualFeaturesColorScales,
                labelScale,
                userAnnotationScale,
                variant
            ),
        [
            activeFeatures,
            featureColorScale,
            featureHiLoScale,
            individualFeaturesColorScales,
            labelScale,
            userAnnotationScale,
            variant,
        ]
    );
};

/**
 * Build a sequential scale according to parameters.
 * @param {Array<string, string>} range The range of color values
 * @param {Array<number>} domain The domain of values
 * @param {number | undefined} saturation The saturation to apply to the colors
 * @param {string} scaleType 'symlogSequential' if the scale is symlogSequential
 * @returns {ScaleSequential} the sequential scale.
 */
export const buildSequentialScale = (
    range: [string, string],
    domain: number[],
    saturation: number | undefined,
    scaleType?: FeatureGradientScaleType
) => {
    const [colorStart, colorEnd] = range;

    const scale =
        scaleType && scaleType === 'symlogSequential'
            ? scaleSequentialSymlog
            : scaleSequential;

    const end = hsl(colorEnd);
    if (saturation) {
        end.s = saturation;
    }

    //color must be hsl or s values will be clamped at 1
    return scale<string>(interpolateHsl(colorStart, end)).domain(
        extent(domain) as [number, number]
    );
};

/**
 * Create the color scale according to parameters.
 * @param {Array<string>} activeFeatures The currently active features
 * @param {ScaleSequential<string>} featureColorScale The feature color scale
 * @param {ScaleOrdinal<string, string>} featureHiLoScale The feature hilo scale
 * @param {ScaleOrdinal<string, string>} labelScale The label scale
 * @param {ScaleSequential<string>} userAnnotationScale The user annotation scale
 * @param variant: "labelCount" | "featureAverage" | "featureHiLos" | "userAnnotation"
 * @returns The scale and function that takes a node and returns the corresponding color
 */
export const makeColorScale = (
    activeFeatures: string[],
    featureColorScale: ScaleSequential<string>,
    featureHiLoScale: ScaleOrdinal<string, string>,
    individualFeaturesColorScales: Record<string, ScaleSequential<string>>,
    labelScale: ScaleOrdinal<string, string>,
    userAnnotationScale: ScaleSequential<string>,
    variant: ColorScaleVariant
) => {
    let scale:
        | ScaleOrdinal<string, string>
        | ScaleSequential<string>
        | Record<string, ScaleSequential<string>>;
    let scaleFunction: (node: TMCHiearchyNode) => string;
    switch (variant) {
        case 'labelCount':
            scale = labelScale;
            scaleFunction = buildLabelColorFunction(labelScale);
            break;
        case 'featureAverage':
            scale = featureColorScale;
            scaleFunction = (node: TMCHiearchyNode) => {
                const featureAverage = getFeatureAverage(node, activeFeatures);
                return featureColorScale(featureAverage);
            };
            break;
        case 'featureCount':
            scale = individualFeaturesColorScales;
            scaleFunction = (node: TMCHiearchyNode) => {
                const weightMap = getEntries(
                    individualFeaturesColorScales
                ).map<{
                    color: string;
                    weight: number;
                }>(([k, v]) => {
                    return {
                        color: v(
                            (node.data.featureCount[k]?.scaleKey as number) || 0
                        ),
                        weight:
                            (node.data.featureCount[k]?.scaleKey as number) ||
                            1e-6,
                    };
                });

                return blendWeighted(weightMap).toString();
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

        case 'userAnnotation':
            scale = userAnnotationScale;
            scaleFunction = (node: TMCHiearchyNode) =>
                userAnnotationScale(
                    Object.values(node.data.userAnnotation)[0]?.quantity
                );
            break;
    }
    return { scaleFunction, scale };
};

/**
 * Calculate a node's average feature count (divided by descendant count) by dividing by the active feature count
 * @param {TMCHiearchyNode} node
 * @param {Array<string>} activeFeatures
 * @returns number
 */
export const getFeatureAverage = (
    node: TMCHiearchyNode,
    activeFeatures: string[]
) =>
    sum(
        Object.entries(node.data.featureCount)
            //eslint-disable-next-line @typescript-eslint/no-unused-vars
            .filter(([k, v]) => activeFeatures.includes(k))
            //`quantity` is raw value, scaleKey is divided by descendant count
            //eslint-disable-next-line @typescript-eslint/no-unused-vars
            .flatMap(([k, v]) => v.scaleKey as number)
    ) / activeFeatures.length;

/**
 * Create the label color function (currenly implemented only for label count)
 * @param {ScaleOrdinal<string, string>} labelScale
 * @returns A function that takes a node as an argument and returns its color
 */
export const buildLabelColorFunction = (
    labelScale: ScaleOrdinal<string, string>
): ((node: TMCHiearchyNode) => string) => {
    return (node: TMCHiearchyNode) => {
        const color = getLabelColor(labelScale, node, 'labelCount');
        return color.toString();
    };
};

type BlendArg = { color: string; weight: number };

/**
 *
 * @param {Array<BlendArg>} colors Mappings of colors to weights
 * @returns {RBGColor} The blended color
 */
export const blendWeighted = (colors: BlendArg[]) => {
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

/**
 * Calculate the blended color for a node on the given scale
 * @param {ScaleOrdinal<string, string>} scale The ordinal scale to use
 * @param {TMCHiearchyNode} node
 * @param {string} colorSource The key in the node to use get the color
 * @returns {RGBColor}
 */
export function getLabelColor(
    scale: ScaleOrdinal<string, string>,
    node: TMCHiearchyNode,
    colorSource: 'featureHiLos' | 'labelCount'
) {
    const blendValues = node.data[colorSource];

    return getBlendedColor(blendValues, scale);
}

/**
 * Calculate the weights for a blended color
 * @param {AttributeMap} counts The mapping of values and counts
 * @param {ScaleOrdinal<string, string> | ScaleLinear<any, any>} scale
 * @returns {RGBColor}
 */
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
