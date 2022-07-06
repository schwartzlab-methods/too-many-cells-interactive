import { useMemo } from 'react';
import { min, range as d3Range, sum } from 'd3-array';
import { color, rgb } from 'd3-color';
import { HierarchyPointNode } from 'd3-hierarchy';
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
    Scales,
    selectScales,
    selectToggleableDisplayElements,
} from '../redux/displayConfigSlice';
import { AttributeMap, TMCNode } from '../types';
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
    const { domain, range } = useAppSelector(selectScales)[scaleName];
    return useMemo(() => {
        return scaleLinear().range(range).domain(domain).clamp(true);
    }, [domain, range]) as ScaleType[K];
};

export const useColorScale = (): {
    scale: ScaleOrdinal<string, string> | ScaleThreshold<any, any>;
    scaleFunction: (node: HierarchyPointNode<TMCNode>) => string;
} => {
    const {
        featureColorBase,
        featureColorDomain,
        featureColorRange,
        featureThresholdDomain,
        featureThresholdRange,
        labelDomain,
        labelRange,
        variant,
    } = useAppSelector(selectScales)['colorScale'];

    const { activeFeatures } = useAppSelector(selectFeatureSlice);

    const { showFeatureOpacity } = useAppSelector(
        selectToggleableDisplayElements
    );

    /* define the color scales */

    const featureOpacityScale = useMemo(() => {
        return buildFeatureLinearScale(featureColorDomain);
    }, [featureColorDomain]);

    const featureColorScale = useMemo(() => {
        const interpolator = interpolateRgb(
            featureColorRange[0],
            featureColorBase
        );
        return scaleThreshold<number, string>()
            .domain(featureOpacityScale.domain().slice())
            .range(featureOpacityScale.range().map(v => interpolator(v)));
    }, [featureColorBase, featureColorRange, featureOpacityScale]);

    const featureHiLoScale = useMemo(() => {
        return scaleOrdinal(featureThresholdRange).domain(
            featureThresholdDomain
        );
    }, [featureThresholdDomain, featureThresholdRange]);

    const labelScale = useMemo(() => {
        return scaleOrdinal(labelRange).domain(labelDomain);
    }, [labelDomain, labelRange]);

    /* return the active scale with wrapper function to handle node-level blending/opacity logic */

    return useMemo(() => {
        let scale:
            | ScaleOrdinal<string, string>
            | ScaleThreshold<number, string>;
        let scaleFunction: (node: HierarchyPointNode<TMCNode>) => string;
        switch (variant) {
            case 'labelCount':
                scale = labelScale;
                scaleFunction = buildLabelColorFunction(
                    activeFeatures,
                    labelScale,
                    featureOpacityScale,
                    showFeatureOpacity
                );
                break;
            case 'featureCount':
                scale = featureColorScale;
                scaleFunction = (node: HierarchyPointNode<TMCNode>) => {
                    const featureAverage = getFeatureAverage(
                        node,
                        activeFeatures
                    );
                    return featureColorScale(featureAverage);
                };
                break;

            case 'featureHiLos':
                scale = featureHiLoScale;
                scaleFunction = (node: HierarchyPointNode<TMCNode>) => {
                    return getLabelColor(
                        featureHiLoScale,
                        node,
                        'featureHiLos'
                    ).toString();
                };
                break;
        }
        return { scaleFunction, scale };
    }, [
        activeFeatures,
        featureColorScale,
        featureHiLoScale,
        featureOpacityScale,
        labelScale,
        showFeatureOpacity,
        variant,
    ]);
};

const getFeatureAverage = (
    node: HierarchyPointNode<TMCNode>,
    activeFeatures: string[]
) =>
    sum(
        Object.entries(node.data.featureCount)
            .filter(([k, v]) => activeFeatures.includes(k))
            //`quantity` is raw value, scaleKey is divided by descendant count
            .flatMap(([k, v]) => v.scaleKey as number)
    ) / activeFeatures.length;

const buildLabelColorFunction = (
    activeFeatures: string[],
    labelScale: ScaleOrdinal<string, string>,
    featureOpacityScale: ScaleThreshold<number, number, never>,
    showFeatureOpacity: boolean
): ((node: HierarchyPointNode<TMCNode>) => string) => {
    return (node: HierarchyPointNode<TMCNode>) => {
        const color = getLabelColor(labelScale, node, 'labelCount');
        if (showFeatureOpacity) {
            const featureAverage = getFeatureAverage(node, activeFeatures);
            color.opacity = featureOpacityScale(featureAverage);
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

function getLabelColor(
    scale: ScaleOrdinal<string, string>,
    node: HierarchyPointNode<TMCNode>,
    colorSource: 'featureHiLos' | 'labelCount'
) {
    const blendValues = node.data[colorSource];

    return getBlendedColor(blendValues, scale);
}

const getBlendedColor = (
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
const buildFeatureLinearScale = (domain: number[]) => {
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
