import { pointRadial } from 'd3-shape';
import { median } from 'd3-array';
import {
    carToRadius,
    carToTheta,
    getMAD,
    madCountToValue,
    valueToMadCount,
} from '../util';

describe('Test mad methods', () => {
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

    test('It should return the correct mad count', () => {
        const values = [4, 3, 1, 2, 10, 10];
        const mad = getMAD(values)!;
        const med = median(values)!;
        expect(med).toEqual(3.5);
        expect(mad).toEqual(2);
        /* we expect 3.25 b/c value (10) - median (3.5) = distance (6.5), divided by mad (2), gives 3.25 */
        expect(valueToMadCount(10, med, mad)).toEqual(3.25);
    });

    test('It should return the correct value', () => {
        const values = [4, 3, 1, 2, 10, 10];
        const mad = getMAD(values)!;
        const med = median(values)!;
        expect(med).toEqual(3.5);
        expect(mad).toEqual(2);
        /* reverse of the above */
        expect(madCountToValue(3.25, med, mad)).toEqual(10);
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
