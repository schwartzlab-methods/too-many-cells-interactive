import { carToRadius, carToTheta, getMAD } from '../util';
import { pointRadial } from 'd3-shape';
import { median } from 'd3-array';

describe('Test getMad', () => {
    test('It should return the median for a list of numbers with an even length', () => {
        expect(median([4, 3, 1, 2, 10, 10])).toEqual(3.5);
    });

    /* compare results with scipy.stats.median_abs_deviation w/ default args */
    test('It should return the Median Absolute Deviation for a list of numbers with an odd length', () => {
        expect(getMAD([4, 3, 5, 1, 2])).toEqual(1);
    });

    test('It should return the Median Absolute Deviation for a list of numbers with an even length', () => {
        expect(getMAD([4, 3, 1, 2, 10, 10])).toEqual(2);
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
