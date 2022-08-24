import { saveAs } from 'file-saver';
import { ScaleOrdinal, ScaleSequential } from 'd3-scale';
import { BaseType, select, Selection } from 'd3-selection';
import { scaleIsSequential } from './types';

const getSvgSrc = (
    colorScale: ScaleOrdinal<string, string> | ScaleSequential<string>,
    selector: string
) => {
    const fontSize = 20;

    const clonedParent = (select(selector).node() as Element).cloneNode(
        true
    ) as Element;

    const clonedSvg = select(clonedParent.getElementsByTagName('svg').item(0)!)
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('version', 1.1);

    //we have to redraw/attach legend as SVG b/c display DOM legend is a react component
    attachLegend(clonedSvg, colorScale, fontSize);

    return `data:image/svg+xml;base64,\n${window.btoa(clonedParent.innerHTML)}`;
};

/**
 * Attach legend -- mutates svg element
 */
export const attachLegend = (
    svg: Selection<SVGSVGElement, unknown, any, unknown>,
    colorScale: ScaleOrdinal<string, string> | ScaleSequential<string>,
    fontSize = 20
) => {
    const hasOrdinalScale = !scaleIsSequential(colorScale);

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

    if (hasOrdinalScale) {
        legend
            .selectAll('g.item')
            .data(colorScale.domain())
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
                        .attr('fill', d => colorScale(d));

                    g.append('text')
                        .text(d => d)
                        .style('font-size', fontSize)
                        .attr('dx', fontSize / 2);
                });
            });
    } else {
        const gradient = legend
            .append('linearGradient')
            .attr('id', 'scaleGradientDownload');
        gradient
            .append('stop')
            .attr('offset', '5%')
            //@ts-ignore // bad typing -- submit PR if it works...
            .attr('stop-color', colorScale.range()[0]);
        gradient
            .append('stop')
            .attr('offset', '95%')
            .attr(
                'stop-color',
                //@ts-ignore // bad typing
                colorScale.range()[colorScale.range().length - 1]
            );

        legend
            .append('text')
            .text(Math.floor(colorScale.domain()[0]))
            .style('font-size', fontSize)
            .attr('text-anchor', 'end')
            .attr('transform', `translate(-10, ${fontSize})`);

        legend
            .append('rect')
            .attr('fill', "url('#scaleGradientDownload')")
            .attr('height', 25)
            .attr('width', 200);

        legend
            .append('text')
            .style('font-size', fontSize)
            .attr('text-anchor', 'start')
            .attr('transform', `translate(210, ${fontSize})`)
            .text(
                Math.ceil(colorScale.domain()[colorScale.domain().length - 1])
            );
    }
};

export const downloadPng = (
    colorScale: ScaleOrdinal<string, string> | ScaleSequential<string>,
    selector: string
) => {
    const w = (select(selector).select('svg').node() as Element).clientWidth;
    const h = (select(selector).select('svg').node() as Element).clientHeight;

    const src = getSvgSrc(colorScale, selector);

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

export const downloadSvg = (
    colorScale: ScaleOrdinal<string, string> | ScaleSequential<string>,
    selector: string
) => {
    const svgSrc = getSvgSrc(colorScale, selector);
    saveAs(svgSrc);
};
