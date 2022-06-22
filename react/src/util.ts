import { median } from 'd3-array';
import { color } from 'd3-color';
import { format } from 'd3-format';
import { HierarchyNode, HierarchyPointNode, tree } from 'd3-hierarchy';
import { interpolate } from 'd3-interpolate';
import { scaleOrdinal } from 'd3-scale';
import { schemeSet1 } from 'd3-scale-chromatic';
import { ColorScaleVariant } from './redux/displayConfigSlice';
import {
    AllPruner,
    ClickPruner,
    ClickPruneType,
    PruneHistory,
    PruneStep,
    ValuePruneType,
} from './redux/pruneSlice';
import { AttributeMap, TMCNode } from './types';

/* typescript-friendly */
export const getEntries = <T>(obj: T) =>
    Object.entries(obj) as [keyof T, T[keyof T]][];

/**
 * Calculate the distance from the origin, used to get radius value for polar coordinates
 *
 * @param x number
 * @param y number
 * @returns number
 */
export const carToRadius = (x: number, y: number) => Math.hypot(x, y);

/**
 * Calculate theta for polar coordinates from a pair of cartesian coordinates.
 *
 * @param x number
 * @param y number
 * @returns number
 */
export const carToTheta = (x: number, y: number) =>
    Math.atan2(y, x) + Math.PI / 2;

/**
 * @param base number
 * @returns the number squared
 */
export const squared = (base: number) => Math.pow(base, 2);

/**
 * Calculate the median absolute distance
 * @param values array of numbers
 * @returns float
 */
export const getMAD = (values: number[]) => {
    const med = median(values)!;

    const distances = values.map(v => Math.abs(v - med));

    return median(distances);
};

/**
 * @param minSize Minimum value for node (and therefore all children) in order to remain in the graphic
 */
export const getSizePrunedRemainder = (
    tree: HierarchyNode<TMCNode>,
    minSize: number
) => {
    const pruned = pruneTreeByMinValue(tree, minSize);
    return pruned.descendants().length;
};

/**
 * @param tree The original tree (i.e., tree with all possible nodes)
 * @param minSize Minimum value for node (and therefore all children) in order to remain in the graphic
 * @returns tree pruned of nodes (and siblings) that did not meet {@code minSize}
 */
export const pruneTreeByMinValue = (
    tree: HierarchyNode<TMCNode>,
    minSize: number
) => {
    const newTree = tree.copy().eachBefore(d => {
        if (d.value! < minSize) {
            if (d.parent) {
                d.parent.children = undefined;
            }
        }
    });
    return newTree;
};

export const pruneTreeByDepth = (tree: HierarchyNode<TMCNode>, depth: number) =>
    tree.copy().eachAfter(d => {
        if (d.depth > depth && d.parent) {
            d.parent!.children = undefined;
        }
    });

/**
 * Stopping criteria to stop at the node immediate after a node with DOUBLE distance.
 * So a node N with L and R children will stop with this criteria the distance at N to L and R is < DOUBLE.
 * Includes L and R in the final result."
 *
 * https://github.com/GregorySchwartz/too-many-cells/blob/master/src/TooManyCells/Program/Options.hs#L43
 */
export const pruneTreeByMinDistance = (
    tree: HierarchyNode<TMCNode>,
    distance: number
) =>
    tree.copy().eachBefore(d => {
        if (!d.data.distance || d.data.distance < distance) {
            //keep the node, even though it's under the threshold, but eliminate the children
            d.children = undefined;
        }
    });

/* 
    Similar to --min-distance, but searches from the leaves to the root -- if a path from a subtree contains a distance of at least DOUBLE, 
    keep that path, otherwise prune it. This argument assists in finding distant nodes."
    https://github.com/GregorySchwartz/too-many-cells/blob/master/src/TooManyCells/Program/Options.hs#L44
    */
export const pruneTreeByMinDistanceSearch = (
    tree: HierarchyNode<TMCNode>,
    distance: number
) =>
    tree.copy().eachAfter(d => {
        if (!d.data.distance || d.data.distance < distance) {
            if (d.parent) {
                d.parent.children = undefined;
            }
        }
    });

export const setRootNode = (tree: HierarchyNode<TMCNode>, nodeId: string) => {
    const targetNode = tree.find(n => n.data.id === nodeId)!.copy();
    // if we reinstate, stratify() will fail if
    // root node data has a parent
    targetNode.parent = null;
    targetNode.data.parentId = undefined;
    return targetNode;
};

export const collapseNode = (tree: HierarchyNode<TMCNode>, nodeId: string) =>
    tree.copy().eachAfter(n => {
        if (n.data.id === nodeId) {
            n.children = undefined;
        }
    });

/**
 *
 * @param nodes Hierarchy node
 * @param w width of the viewport
 * @returns Hierarchy point node (i.e., tree structure with polar position coordinates bound)
 */
export const calculateTreeLayout = (nodes: HierarchyNode<TMCNode>, w: number) =>
    tree<TMCNode>()
        .size([2 * Math.PI, (w / 2) * 0.9])
        .separation((a, b) => (a.parent == b.parent ? 3 : 2) / a.depth)(nodes);

export const pruneStepIsEmpty = (ctx: Readonly<PruneStep>) =>
    getObjectIsEmpty(ctx.clickPruneHistory) &&
    getObjectIsEmpty(ctx.valuePruner);

export const getObjectIsEmpty = (obj: Record<any, any>) =>
    !Object.keys(obj).length;

export const pruneContextsAreEqual = (
    ctx1: Readonly<PruneStep>,
    ctx2: Readonly<PruneStep>
) =>
    ctx1.clickPruneHistory.length === ctx2.clickPruneHistory.length &&
    valuePrunersAreEqual(ctx1, ctx2);

export const valuePrunersAreEqual = (
    ctx1: Readonly<PruneStep>,
    ctx2: Readonly<PruneStep>
) =>
    ctx1.valuePruner.key === ctx2.valuePruner.key &&
    ctx1.valuePruner.value === ctx2.valuePruner.value;

export const formatDistance = (distance: number) => format('.3f')(distance);
export const formatInteger = (int: number) => format('.0f')(int);

/* merge two dictionaries by summing corresponding values */
export const mergeAttributeMaps = (obj1: AttributeMap, obj2: AttributeMap) =>
    [
        ...new Set([...Object.keys(obj1), ...Object.keys(obj2)]),
    ].reduce<AttributeMap>(
        (acc, k) => ({
            ...acc,
            [k]: {
                quantity: (obj1[k]?.quantity || 0) + (obj2[k]?.quantity || 0),
                scaleKey: obj1[k]?.scaleKey || obj2[k].scaleKey,
            },
        }),
        {}
    );

/**
 * If domain count is greater than count of colors in scale,
 *  return a new scale with the extra colors evenly distributed
 *
 * @param domain
 * @returns string[]
 */
export const interpolateColorScale = (domain: string[]) => {
    if (domain.length <= schemeSet1.length) {
        return schemeSet1.slice(0, domain.length) as string[];
    }

    const step = (schemeSet1.length - 1) / domain.length;

    return Array(domain.length)
        .fill(null)
        .map((_, i) => {
            const base = Math.floor(i * step);
            const next = base + 1;
            const k = i * step - base;
            const interpolated = interpolate(
                schemeSet1[base],
                schemeSet1[next]
            )(k);
            return color(interpolated)!.formatHex();
        });
};

export const calculateColorScaleRangeAndDomain = (
    colorScaleKey: ColorScaleVariant,
    nodes: HierarchyPointNode<TMCNode>
) => {
    const domain = [
        ...new Set(
            nodes
                .descendants()
                .flatMap(v =>
                    Object.values(v.data[colorScaleKey]).flatMap(
                        v => v.scaleKey
                    )
                )
        ),
    ].sort((a, b) => (a < b ? -1 : 1));

    const range = interpolateColorScale(domain);

    return { range, domain };
};

export const rerunPrunes = (
    activeStepIdx: number,
    pruneHistory: PruneHistory,
    tree: HierarchyNode<TMCNode>
) => {
    let i = 0;
    let _prunedNodes = tree;
    while (i <= activeStepIdx) {
        _prunedNodes = runPrune(pruneHistory[i].valuePruner, _prunedNodes);

        _prunedNodes = runClickPrunes(
            pruneHistory[i].clickPruneHistory,
            _prunedNodes
        );
        i++;
    }
    return _prunedNodes;
};

const isClickPruner = (pruner: ClickPruner | any): pruner is ClickPruner => {
    return ['setCollapsedNode', 'setRootNode'].includes(pruner.key);
};

export const runClickPrunes = (
    clickPruneHistory: ClickPruner[],
    tree: HierarchyNode<TMCNode>
) => {
    let i = 0;
    let _tree = tree.copy();
    while (i < clickPruneHistory.length) {
        _tree = runPrune(clickPruneHistory[i], _tree);
        i++;
    }
    return _tree;
};

const pruners = {
    minDepth: pruneTreeByDepth,
    minSize: pruneTreeByMinValue,
    minDistance: pruneTreeByMinDistance,
    minDistanceSearch: pruneTreeByMinDistanceSearch,
    setCollapsedNode: collapseNode,
    setRootNode: setRootNode,
};

export const runPrune = (arg: AllPruner, tree: HierarchyNode<TMCNode>) => {
    if (!arg.key) return tree;
    if (isClickPruner(arg)) {
        return pruners[arg.key as ClickPruneType](tree, arg.value!);
    } else {
        return pruners[arg.key as ValuePruneType](tree, arg.value! as number);
    }
};

// taken from here: https://gist.github.com/keesey/e09d0af833476385b9ee13b6d26a2b84
export const levenshtein = (a: string, b: string): number => {
    const an = a ? a.length : 0;
    const bn = b ? b.length : 0;
    if (an === 0) {
        return bn;
    }
    if (bn === 0) {
        return an;
    }
    const matrix = new Array(bn + 1);
    for (let i = 0; i <= bn; ++i) {
        const row = (matrix[i] = new Array<number>(an + 1));
        row[0] = i;
    }
    const firstRow = matrix[0];
    for (let j = 1; j <= an; ++j) {
        firstRow[j] = j;
    }
    for (let i = 1; i <= bn; ++i) {
        for (let j = 1; j <= an; ++j) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] =
                    Math.min(
                        matrix[i - 1][j - 1], // substitution
                        matrix[i][j - 1], // insertion
                        matrix[i - 1][j] // deletion
                    ) + 1;
            }
        }
    }
    return matrix[bn][an];
};

export const getScaleCombinations = (featureList: string[]) =>
    featureList
        .sort((a, b) => (a > b ? -1 : 1))
        .map(s => [`high-${s}`, `low-${s}`])
        .reduce((acc, curr) => {
            if (!acc.length) {
                return curr;
            } else {
                const ret = [];
                for (const item of acc) {
                    for (const inner of curr) {
                        ret.push(`${inner}-${item}`);
                    }
                }
                return ret;
            }
        }, []);

export const addGray = (domain: string[], range: string[]) => {
    const allLowIdx = domain.findIndex(item => !item.includes('high'));
    if (allLowIdx) {
        range[allLowIdx] = '#D3D3D3';
    }
    return range;
};
