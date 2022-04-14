import { median } from 'd3-array';
import { hierarchy, HierarchyNode, tree } from 'd3-hierarchy';
import { TMCNodeBase, TMCNode } from './types';

/**
 * Sort chlildren in descending order -- important for ensuring stable node IDs
 *
 * @param node
 * @returns Hierarchy Node
 */
export const sortChildren = <T extends TMCNodeBase>(node: HierarchyNode<T>) =>
    node.sort((a, b) => {
        const aval = a.data.items ? a.data.items.length : 0;
        const bval = b.data.items ? b.data.items.length : 0;
        return aval > bval ? -1 : 1;
    });

/**
 * Prepare data for use by d3's hierarchical layouts
 * @param data a TooManyCells node, converted from nested-list form
 * @returns HiearchyNode w/ data prop containing node properties
 */
export const hierarchize = (data: TMCNodeBase) =>
    sortChildren
        .call(
            null,
            hierarchy(data)
        ) /* set {@code value} for each node as sum of {@code item}s in descendants */
        .sum(d => (d.items ? d.items.length : 0));
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
 * @param minSize Minimum value for node (and therefore all children) in order to remain in the graphic
 * @returns tree pruned of nodes (and siblings) that did not meet {@code minSize}
 */
export const pruneTreeByMinValue = (
    tree: HierarchyNode<TMCNode>,
    minSize: number
) => {
    const newTree = tree.copy().eachBefore(d => {
        if (d.value! < minSize) {
            if (d.data.parent && d.parent) {
                d.data.parent.children = null;
                d.parent.children = undefined;
            }
        }
    });
    return newTree;
};

/**
 *
 * @param nodes Hierarchy node
 * @param w width of the viewport
 * @returns Hierarchy point node (i.e., tree structure with polar position coordinates bound)
 */
export const buildTree = (nodes: HierarchyNode<TMCNode>, w: number) =>
    tree<TMCNode>()
        .size([2 * Math.PI, (w / 2) * 0.9])
        .separation((a, b) => (a.parent == b.parent ? 3 : 2) / a.depth)(nodes);

/**
 * Remove a node and all its children from the tree and recalculate layout
 *
 * @param tree HierarchyNode
 * @param nodeId string The ID of the node to prune
 */
export const pruneNodeById = (
    tree: HierarchyNode<TMCNode>,
    nodeId: string,
    width: number
) => {
    const node = tree.find(n => n.data.id === nodeId);
    if (!node) {
        throw 'Node not found!';
    }
    const descIds = node.descendants().map(d => d.data.id);
    const newNodes = tree
        .descendants()
        .filter(n => !descIds.includes(n.data.id))
        .map(d => d.data);
    //return buildTree(hierarchize(newNodes), width);
};

/**
 * Add a node and all its children to the tree and recalculate layout
 *
 * @param tree HierarchyNode
 * @param nodeId string The ID of the node to prune
 */
export const reinstateNode = (
    tree: HierarchyNode<TMCNode>,
    node: HierarchyNode<TMCNode>
) => {};
