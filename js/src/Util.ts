import { quantile } from 'd3-array';
import { hierarchy, HierarchyNode } from 'd3-hierarchy';
import { TMCNodeBase } from './prepareData';
import { TMCNode } from './Tree';

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
        ) /* this sets `value` for each node as sum of items in descendants */
        .sum(d => (d.items ? d.items.length : 0));

export const carToRadius = (x: number, y: number) => Math.hypot(x, y);

export const carToTheta = (x: number, y: number) =>
    Math.atan2(y, x) + Math.PI / 2;

/**
 * @param base number
 * @returns the number squared
 */
export const squared = (base: number) => Math.pow(base, 2);

/**
 * Get the Median Absolute Deviation for a node and all of its children's values
 * @param nodes
 * @returns float
 */
export const getMADNodes = (nodes: HierarchyNode<TMCNode>) => {
    const values = nodes.descendants().map(n => n.value || 0);

    return getMAD(values);
};

/**
 * Calculate the median absolute distance for a node and its children
 * @param values array of numbers
 * @returns float
 */
export const getMAD = (values: number[]) => {
    const median = quantile(values, 0.5)!;

    const distances = values.map(v => Math.abs(v - median));

    return quantile(distances, 0.5);
};
