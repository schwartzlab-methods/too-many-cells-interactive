import { TMCNodeBase } from '../prepareData';
import { carToRadius, carToTheta, getMAD, hierarchize } from '../Util';
import { uuid } from 'lodash-uuid';
import { pointRadial } from 'd3-shape';
import { quantile } from 'd3-array';

/**
 * Make some test data that mimics TMC input
 * @param maxDepth the number of generations in the tree
 * @param depth the current generation
 * @param parent the node's parent (if any)
 * @returns
 */
const makeTestNode = (
    maxDepth = 3,
    depth = 0,
    parent?: TMCNodeBase
): TMCNodeBase => {
    const node = {} as TMCNodeBase;
    node.parent = parent;
    node.id = uuid();
    node.items = Array(depth + 1)
        .fill(null)
        .map(() => ({
            _barcode: { unCell: 'abc' },
            _cellRow: { unRow: 2 },
        }));
    node.distance = Math.random();
    node.significance = Math.random();
    node.children =
        depth < maxDepth
            ? [1, 2].map(() => makeTestNode(maxDepth, depth + 1, node))
            : null;
    return node;
};

const makeTestHierarchicalNodes = (
    maxDepth = 3,
    depth = 0,
    parent?: TMCNodeBase
) => hierarchize(makeTestNode(maxDepth, depth));

describe('Test getMad', () => {
    /* compare results with scipy.stats.median_abs_deviation w/ default args */
    test('It should return the Median Absolute Deviation for a list of numbers with an odd length', () => {
        expect(getMAD([4, 3, 5, 1, 2])).toEqual(1);
    });

    test('It should return the Median Absolute Deviation for a list of numbers with an even length', () => {
        expect(getMAD([4, 3, 1, 2, 10, 10])).toEqual(2);
    });

    test('It should return the Median Absolute Deviation for a list of numbers with an even length', () => {
        expect(quantile([4, 3, 1, 2, 10, 10], 0.5)).toEqual(3.5);
    });
});

describe('Test carToPolar', () => {
    test('It should return the appropriate polar coordinate', () => {
        const theta = Math.PI / 2;
        const radius = 10;
        const polar = pointRadial(theta, radius);
        expect(carToTheta(...polar)).toEqual(theta);
        expect(carToRadius(...polar)).toEqual(radius);
    });
});
