import { extent, median } from 'd3-array';
import { color } from 'd3-color';
import { format } from 'd3-format';
import { HierarchyNode, tree } from 'd3-hierarchy';
import { interpolate } from 'd3-interpolate';
import { schemeSet1 } from 'd3-scale-chromatic';
import {
    AllPruner,
    ClickPruner,
    ClickPruneType,
    PruneStep,
    ValuePruner,
    ValuePruneType,
} from './redux/pruneSlice';
import { AttributeMap, TMCHierarchyDataNode, TMCNode } from './types';

/**
 * Typescript friendly getEntries
 * @param {Record<k, v>} obj
 * @returns {Array<Array<k,v>>}
 */
export const getEntries = <T extends Record<string, unknown>>(obj: T) =>
    Object.entries(obj) as [keyof T, T[keyof T]][];

/**
 * Typescript friendly getKeys
 * @param {Record<k, v>} obj
 * @returns {Array<Array<v>>}
 */
export const getKeys = <T extends Record<string, unknown>>(obj: T) =>
    Object.keys(obj) as (keyof T)[];

/**
 * Calculate the distance from the origin, used to get radius value for polar coordinates
 *
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export const carToRadius = (x: number, y: number) => Math.hypot(x, y);

/**
 * Calculate theta for polar coordinates from a pair of cartesian coordinates.
 *
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export const carToTheta = (x: number, y: number) =>
    Math.atan2(y, x) + Math.PI / 2;

/**
 * @param {number} base
 * @returns the number squared
 */
export const squared = (base: number) => Math.pow(base, 2);

/**
 * Calculate the median absolute distance
 * @param {Array<number>} values
 * @returns {number}
 */
export const getMAD = (values: number[]) => {
    const med = median(values)!;

    const distances = values.map(v => Math.abs(v - med));

    return median(distances)!;
};

/**
 * Calculate the median absolute distance for the distance property, excluding zeroes
 * @param {TMCHierarchyDataNode} node a TMC Tree
 * @returns {number}
 */
export const getDistances = (node: TMCHierarchyDataNode) =>
    node
        .descendants()
        .map(v => v.data.distance!)
        .filter(Boolean)!;

/**
 * Calculate the median absolute distance for node size
 * @param {TMCHierarchyDataNode} node a TMC Tree
 * @returns {number}
 */
export const getSizes = (node: TMCHierarchyDataNode) =>
    node.descendants().map(v => v.value!)!;

/**
 * Return value as count of MADs from given median
 * @param {number} value
 * @param {number} median
 * @param {number} mad
 * @returns {number}
 */
export const valueToMadCount = (value: number, median: number, mad: number) => {
    return Math.abs(value - median) / mad;
};

/**
 * Return value as count of MADs from given median, signed by position wrt median
 * @param {number} value
 * @param {number} median
 * @param {number} mad
 * @returns {number}
 */
export const valueToMadCountSigned = (
    value: number,
    median: number,
    mad: number
) => valueToMadCount(value, median, mad) * (value > median ? 1 : -1);

/**
 * Return mad count as value, given median and mad
 * @param {number} madCount
 * @param {number} median
 * @param {number} mad
 * @returns {number}
 */
export const madCountToValue = (
    madCount: number,
    median: number,
    mad: number
) => median + madCount * mad;

/* this is mainly for exporting to backend to avoid 2 d3 dependencies */
export const getMedian = (values: number[]) => median(values) || 0;

/* this is mainly for exporting to backend to avoid 2 d3 dependencies */
export const getExtent = (values: number[]) =>
    (values.length ? extent(values) : [0, 0]) as [number, number];

/**
 * Get minimum value to remain in tree
 * @param {TMCHierarchyDataNode} tree
 * @param {number} minSize Minimum value for node (and therefore all children) in order to remain in the graphic
 */
export const getSizePrunedRemainder = (
    tree: TMCHierarchyDataNode,
    minSize: number
) => {
    const pruned = pruneTreeByMinValue(tree, minSize);
    return pruned.descendants().length;
};

/**
 * Prune the tree by a minimum value
 * @param {TMCHierarchyDataNode} tree The original tree (i.e., tree with all possible nodes)
 * @param {number} minSize Minimum value for node (and therefore all children) in order to remain in the graphic
 * @returns tree pruned of nodes (and siblings) that did not meet {@code minSize}
 */
export const pruneTreeByMinValue = (
    tree: TMCHierarchyDataNode,
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

/**
 * Prune the tree by maximum depth
 * @param {TMCHierarchyDataNode} tree
 * @param {number} depth
 * @returns {TMCHierarchyDataNode}
 */
export const pruneTreeByDepth = (tree: TMCHierarchyDataNode, depth: number) =>
    tree.copy().eachAfter(d => {
        if (d.depth > depth && d.parent) {
            d.parent!.children = undefined;
        }
    });

/**
 * Prune tree by distance
 * Stopping criteria to stop at the node immediate after a node with DOUBLE distance.
 * So a node N with L and R children will stop with this criteria the distance at N to L and R is < DOUBLE.
 * Includes L and R in the final result."
 *
 * https://github.com/GregorySchwartz/too-many-cells/blob/master/src/TooManyCells/Program/Options.hs#L43

 * @param {TMCHierarchyDataNode} tree
 * @param {number} distance
 * @returns {TMCHierarchyDataNode}
 */
export const pruneTreeByMinDistance = (
    tree: TMCHierarchyDataNode,
    distance: number
) =>
    distance
        ? tree.copy().eachBefore(d => {
              if (!d.data.distance || d.data.distance < distance) {
                  //keep the node, even though it's under the threshold, but eliminate the children
                  d.children = undefined;
              }
          })
        : tree.copy();

/**
 * Prune tree my minimum distance-search
 * Similar to --min-distance, but searches from the leaves to the root -- if a path from a subtree contains a distance of at least DOUBLE,
 * keep that path, otherwise prune it. This argument assists in finding distant nodes."
 * https://github.com/GregorySchwartz/too-many-cells/blob/master/src/TooManyCells/Program/Options.hs#L180
 * @param {TMCHierarchyDataNode} tree
 * @param {number} distance
 * @returns {TMCHierarchyDataNode}
 */

export const pruneTreeByMinDistanceSearch = (
    tree: TMCHierarchyDataNode,
    distance: number
) => {
    if (distance) {
        const visited: number[] = [];
        const newTree = tree.copy();
        newTree.eachAfter(d => {
            // NOTE: not sure why this was included, but it was very slow and am commenting out for now.
            // const descendantAlreadyVisited = hasIntersection(
            //     visited,
            //     (tree.descendants() || [])
            //         .find(n => n.data.originalNodeId === d.data.originalNodeId)
            //         ?.descendants()
            //         .map(n => n.data.originalNodeId) || []
            // );

            if (
                !!d.data.distance &&
                d.data.distance <= distance
                //&&
                //!descendantAlreadyVisited
            ) {
                d.children = undefined;
            } else if (d.data.distance) {
                visited.push(d.data.originalNodeId);
            }
        });
        return newTree;
    } else return tree.copy();
};

export const setRootNode = (tree: TMCHierarchyDataNode, nodeId: string) => {
    const targetNode = tree.find(n => n.data.id === nodeId)!.copy();
    // if we reinstate, stratify() will fail if
    // root node data has a parent
    targetNode.parent = null;
    targetNode.data.parentId = undefined;
    return targetNode;
};

export const collapseNode = (tree: TMCHierarchyDataNode, nodeId: string) =>
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
export const calculateTreeLayout = (
    nodes: TMCHierarchyDataNode | HierarchyNode<TMCNode>,
    w: number
) =>
    tree<TMCNode>()
        .size([2 * Math.PI, (w / 2) * 0.9])
        .separation((a, b) => (a.parent == b.parent ? 3 : 2) / a.depth)(nodes);

export const pruneStepIsEmpty = (ctx: Readonly<PruneStep>) =>
    getObjectIsEmpty(ctx.clickPruneHistory) &&
    getObjectIsEmpty(ctx.valuePruner);

export const getObjectIsEmpty = (obj: Record<any, any>) =>
    !Object.keys(obj).length;

/**
 * Round number and return
 *
 * @param value number
 * @param sd significant digits
 * @returns number
 */
export const roundDigit = (value: number, sd?: number): number => {
    let fmt = '';
    if (!value) {
        return value;
    } else if (sd) {
        fmt = `.${sd}~r`;
    } else if (sd === undefined) {
        //for smaller numbers, use 3 sig digits, stripping trailing zeroes
        if (Math.abs(value) < 10) {
            fmt = `.3~r`;
            //for larger, round to 2 decimal places, stripping trailing zeroes
        } else {
            fmt = `.2~f`;
        }
    }
    let res: number;
    try {
        //for negative numbers, replace d3's dash with javascript's hyphen
        res = +format(fmt)(value).replace('−', '-');
        return res;
    } catch (e) {
        //we don't want the app to blow up if this function can't handle something
        //eslint-disable-next-line no-console
        console.error(e);
        return value;
    }
};

/**
 * Convert number to string, adding commas to numbers greater than a thousand,
 *     otherwise use decimal notation, varying significant digits by size
 *
 * @param value number
 * @returns string
 */
export const formatDigit = (value: number, d?: number) => {
    const rounded = roundDigit(value, d);
    if (rounded > 1000) {
        return format(',d')(rounded);
    } else return rounded;
};

/* merge two dictionaries by summing corresponding values */
export const mergeAttributeMaps = (obj1: AttributeMap, obj2: AttributeMap) =>
    [
        ...new Set([...Object.keys(obj1), ...Object.keys(obj2)]),
    ].reduce<AttributeMap>(
        (acc, k) => ({
            ...acc,
            [k]: {
                quantity: (obj1[k]?.quantity || 0) + (obj2[k]?.quantity || 0),
                scaleKey: obj1[k]?.scaleKey || obj2[k]?.scaleKey,
            },
        }),
        {}
    );

/**
 * If domain count is greater than count of colors in scale, return a new scale with the extra colors evenly distributed
 * @param {Array<string>} domain
 * @returns {Array<string>} the range
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

export const calculateOrdinalColorScaleRangeAndDomain = (
    labelMap: Record<string, string>
) => {
    const domain = [...new Set(Object.values(labelMap))].sort((a, b) =>
        a < b ? -1 : 1
    ) as string[];

    let range = interpolateColorScale(domain);

    const missingLabelIndex = domain.findIndex(d => d === 'Label Not Provided');

    if (missingLabelIndex !== undefined) {
        const newRange = range.slice();
        newRange[missingLabelIndex] = '#000000';
        range = newRange;
    }

    return { range, domain };
};

export type AnyPruneHistory = Partial<PruneStep> &
    Omit<PruneStep, 'clickPruneHistory'>;

export const runPrunes = (
    activeStepIdx: number,
    pruneHistory: AnyPruneHistory[],
    tree: TMCHierarchyDataNode
) => {
    let i = 0;
    let _prunedNodes = tree;
    while (i <= activeStepIdx) {
        _prunedNodes = runPrune(pruneHistory[i].valuePruner, _prunedNodes);

        if (pruneHistory[i].clickPruneHistory) {
            _prunedNodes = runClickPrunes(
                pruneHistory[i].clickPruneHistory as ClickPruner[],
                _prunedNodes
            );
        }
        i++;
    }
    return _prunedNodes;
};

const isValuePruner = (pruner: AllPruner): pruner is ValuePruner =>
    !!(pruner as ValuePruner).value?.madsValue;

export const runClickPrunes = (
    clickPruneHistory: ClickPruner[],
    tree: TMCHierarchyDataNode
) => {
    let i = 0;
    let _tree = tree.copy();
    while (i < clickPruneHistory.length) {
        _tree = runPrune(clickPruneHistory[i], _tree);
        i++;
    }
    return _tree;
};

export const prunerMap = {
    minDepth: pruneTreeByDepth,
    minSize: pruneTreeByMinValue,
    minDistance: pruneTreeByMinDistance,
    minDistanceSearch: pruneTreeByMinDistanceSearch,
    setCollapsedNode: collapseNode,
    setRootNode: setRootNode,
};

export const runPrune = (arg: AllPruner, tree: TMCHierarchyDataNode) => {
    if (!arg.name || !arg.value) return tree;
    if (!isValuePruner(arg)) {
        return prunerMap[arg.name as ClickPruneType](
            tree,
            arg.value.plainValue as string
        );
    } else {
        return prunerMap[arg.name as ValuePruneType](
            tree,
            arg.value.plainValue
        );
    }
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

export const textToAnnotations = (text: string) => {
    const rows = text.split(/\r?\n/).filter(Boolean);

    const headers = rows[0].split(',');
    if (headers.length !== 2) {
        throw 'CSV must have exactly 2 columns.';
    }

    if (!headers.includes('node_id')) {
        throw 'CSV must have one column called `node_id`.';
    }

    const idIdx = headers.findIndex(h => h === 'node_id');
    const dataIdx = idIdx ? 0 : 1;

    const annotations = {} as AttributeMap;

    for (const ann of rows.slice(1)) {
        const data = ann.split(',');
        annotations[+data[idIdx]] = {
            quantity: +data[dataIdx],
            scaleKey: +data[dataIdx],
        };
    }

    return annotations;
};

/**
 * Check if argument is "nillish" but allow 0 (which is falsey)
 * @param arg Any
 * @returns Boolean
 */
export const isNil = (arg: any) => ['', null, undefined].includes(arg);

export const hasIntersection = <T>(a: T[], b: T[]) => {
    const setB = new Set(b);
    return !![...new Set(a)].filter(x => setB.has(x)).length;
};
