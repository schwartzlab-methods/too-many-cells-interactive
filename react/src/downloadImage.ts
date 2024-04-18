import { saveAs } from 'file-saver';
import { range } from 'd3-array';
import { ScaleOrdinal, ScaleSequential } from 'd3-scale';
import { BaseType, select, Selection } from 'd3-selection';
import { scaleIsFeatureIndividual, scaleIsSequential } from './types';
import { formatDigit, getKeys } from './util';

/**
 * Attach an SVG legend to the SVG tree and convert to a data URL for download
 *
 * @param {(ScaleOrdinal<string, string>
 *         | ScaleSequential<string>
 *         | Record<string, ScaleSequential<string>>)} colorScale
 * @param {string} selector
 * @param {string[]} activeFeatures
 * @return {string} the data URL for the image, base64-encoded
 */
const getSvgSrc = (
    colorScale:
        | ScaleOrdinal<string, string>
        | ScaleSequential<string>
        | Record<string, ScaleSequential<string>>,
    selector: string,
    activeFeatures: string[]
) => {
    const fontSize = 20;

    const clonedParent = (select(selector).node() as Element).cloneNode(
        true
    ) as Element;

    const clonedSvg = select(clonedParent.getElementsByTagName('svg').item(0)!)
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('version', 1.1);

    //we have to redraw/attach legend as SVG b/c display DOM legend is a react component
    attachLegend(clonedSvg, colorScale, fontSize, activeFeatures);

    return `data:image/svg+xml;base64,\n${window.btoa(clonedParent.innerHTML)}`;
};

/**
 * Attach an SVG legen to the SVG chart (mutates svc)
 *
 * @param {Selection<SVGSVGElement, unknown, any, unknown>} svg
 * @param {(ScaleOrdinal<string, string>
 *         | ScaleSequential<string>
 *         | Record<string, ScaleSequential<string>>)} colorScale
 * @param {number} [fontSize=20]
 * @param {string[]} activeFeatures
 * @return {void}
 */
export const attachLegend = (
    svg: Selection<SVGSVGElement, unknown, any, unknown>,
    colorScale:
        | ScaleOrdinal<string, string>
        | ScaleSequential<string>
        | Record<string, ScaleSequential<string>>,
    fontSize = 20,
    activeFeatures: string[]
) => {
    let hasOrdinalScale = false;
    const isIndividualScale = scaleIsFeatureIndividual(colorScale);
    if (!isIndividualScale && !scaleIsSequential(colorScale)) {
        hasOrdinalScale = true;
    }

    const container = svg.select('g.container');

    const [w, h] = svg
        .attr('viewBox')!
        .split(',')
        .slice(2)
        .map(d => +d);

    const newContainerWidth = w * 0.85;
    const legendWidth = w - newContainerWidth;

    container.attr('transform', `translate(-${legendWidth / 2}, 0) scale(.85)`);

    const legend = container
        .append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${w / 2 + 5}, ${-h / 2})`);

    if (hasOrdinalScale && !isIndividualScale) {
        legend
            .selectAll('g.item')
            .data(
                (colorScale as ScaleOrdinal<string, string>)
                    .domain()
                    .filter(Boolean)
            )
            .join('g')
            .each(function (_, i) {
                const container = select<SVGGElement, string>(
                    this as SVGGElement
                ).attr('transform', `translate(0, ${i * fontSize})`);

                container.each(function () {
                    const g = select<SVGGElement | BaseType, string>(this);

                    g.append('circle')
                        .attr('r', fontSize / 3)
                        .attr('cy', -fontSize / 3)
                        .attr('fill', d =>
                            (colorScale as ScaleOrdinal<string, string>)(d)
                        );

                    g.append('text')
                        .text(d => d)
                        .style('font-size', fontSize)
                        .attr('dx', fontSize / 2);
                });
            });
    } else if (!isIndividualScale) {
        const legendHeight = 25;

        attachSequentialLegend(
            legend,
            colorScale as ScaleSequential<string>,
            legendHeight,
            legendWidth,
            fontSize
        );

        legend
            .append('g')
            .attr('transform', `translate(0,${legendHeight + fontSize + 5})`)
            .selectAll('text.feature')
            .data(activeFeatures)
            .join('text')
            .attr('y', (_, i) => fontSize * i)
            .text(d => d);
    } else if (isIndividualScale) {
        const legendHeight = 25;

        getKeys(colorScale).forEach((k, i) => {
            legend
                .append('text')
                .text(k)
                .attr(
                    'transform',
                    `translate(0, ${(legendHeight + fontSize + 2) * i})`
                );
            attachSequentialLegend(
                legend,
                colorScale[k],
                legendHeight,
                legendWidth,
                fontSize,
                i
            );
        });
    }
};

/**
 * Create a gradient legend for the scale and attach to `legendContainer` (mutates argument)
 *
 * @param {Selection<SVGGElement, unknown, any, unknown>} legendContainer
 * @param {ScaleSequential<string>} colorScale
 * @param {number} legendHeight
 * @param {number} legendWidth
 * @param {number} fontSize
 * @param {number} [offsetIdx=0]
 */
const attachSequentialLegend = (
    legendContainer: Selection<SVGGElement, unknown, any, unknown>,
    colorScale: ScaleSequential<string>,
    legendHeight: number,
    legendWidth: number,
    fontSize: number,
    offsetIdx = 0
) => {
    const legend = legendContainer
        .append('g')
        .attr(
            'transform',
            `translate(0, ${offsetIdx * (fontSize + legendHeight + 2)})`
        );

    legend
        .append('defs')
        .append('linearGradient')
        .attr('id', `scaleGradientDownload-${offsetIdx}`)
        .selectAll('stop')
        .data(range(0, 1, 0.01), Math.random)
        .join('stop')
        .attr('offset', d => `${d * 100}%`)
        .attr('stop-color', d =>
            (colorScale as ScaleSequential<string, never>).interpolator()(d)
        );

    legend
        .append('text')
        .text(
            formatDigit(
                (colorScale as ScaleSequential<string, never>).domain()[0]
            )
        )
        .style('font-size', fontSize)
        .attr('text-anchor', 'end')
        .attr('transform', `translate(-10, ${fontSize})`);

    legend
        .append('rect')
        .attr('fill', `url('#scaleGradientDownload-${offsetIdx}')`)
        .attr('height', legendHeight)
        .attr('width', legendWidth - 25);

    legend
        .append('text')
        .style('font-size', fontSize)
        .attr('text-anchor', 'start')
        .attr('transform', `translate(${legendWidth - 15}, ${fontSize})`)
        .text(
            formatDigit(
                (colorScale as ScaleSequential<string, never>).domain()[
                    (colorScale as ScaleSequential<string, never>).domain()
                        .length - 1
                ]
            )
        );
};

/**
 * Conver the SVG at `selector` to a PNG and download
 *
 * @param {(ScaleOrdinal<string, string>
 *         | ScaleSequential<string>
 *         | Record<string, ScaleSequential<string>>)} colorScale
 * @param {string} selector
 * @param {string[]} activeFeatures
 * @returns {void}
 */
export const downloadPng = (
    colorScale:
        | ScaleOrdinal<string, string>
        | ScaleSequential<string>
        | Record<string, ScaleSequential<string>>,
    selector: string,
    activeFeatures: string[]
) => {
    const w = (select(selector).select('svg').node() as Element).clientWidth;
    const h = (select(selector).select('svg').node() as Element).clientHeight;

    const src = getSvgSrc(colorScale, selector, activeFeatures);

    const canvas = document.createElement('canvas')!;
    const context = canvas.getContext('2d')!;

    canvas.width = w;
    canvas.height = h;

    const image = new Image();
    image.src = src;
    image.onload = function () {
        context.clearRect(0, 0, w, h);
        context.drawImage(image, 0, 0, w, h);

        canvas.toBlob(function (blob) {
            saveAs(blob!, 'my-tree.png');
        });
    };
};

/**
 * Download the SVG at `selector`
 *
 * @param {(ScaleOrdinal<string, string>
 *         | ScaleSequential<string>
 *         | Record<string, ScaleSequential<string>>)} colorScale
 * @param {string} selector
 * @param {string[]} activeFeatures
 */
export const downloadSvg = (
    colorScale:
        | ScaleOrdinal<string, string>
        | ScaleSequential<string>
        | Record<string, ScaleSequential<string>>,
    selector: string,
    activeFeatures: string[]
) => {
    const svgSrc = getSvgSrc(colorScale, selector, activeFeatures);
    saveAs(svgSrc);
};
