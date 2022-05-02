import { median } from 'd3-array';
import { HierarchyNode, HierarchyPointNode, tree } from 'd3-hierarchy';
import { buildTree } from './prepareData';
import { TMCNode } from './types';

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
 * Calculate the median absolute distance for a node and its children
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

/**
 * Add a node's children to the tree and recalculate layout
 */
export const reinstateNode = (
    originalTree: HierarchyPointNode<TMCNode>,
    prunedTree: HierarchyPointNode<TMCNode>,
    nodeId: string,
    width: number
) => {
    const node = originalTree.find(n => n.data.id === nodeId);

    if (!node) {
        throw 'Node not found!';
    }

    const newNodes = prunedTree
        .descendants()
        .map(d => d.data)
        .concat(
            (node.children || []).flatMap(c => c.descendants().map(d => d.data))
        );

    return calculateTreeLayout(buildTree(newNodes), width);
};
