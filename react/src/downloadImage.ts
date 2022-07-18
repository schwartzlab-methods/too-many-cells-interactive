import { saveAs } from 'file-saver';
import { ScaleOrdinal, ScaleThreshold } from 'd3-scale';
import { BaseType, select } from 'd3-selection';
import { scaleIsThreshold } from './types';

const getSvgSrc = (
    colorScale: ScaleOrdinal<string, string> | ScaleThreshold<any, any>
) => {
    const hasOrdinalScale = !scaleIsThreshold(colorScale);

    const textHeight = 20;

    const clonedParent = (select('.tree').node() as Element).cloneNode(
        true
    ) as Element;

    const clonedSvg = select(clonedParent.getElementsByTagName('svg').item(0)!)
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('version', 1.1);

    const [w, h] = clonedSvg
        .attr('viewBox')!
        .split(',')
        .slice(2)
        .map(d => +d);

    /* reset any zoom/panning, leaving some margin for legend */
    clonedSvg
        .select('g.container')
        .attr(
            'transform',
            `translate(${hasOrdinalScale ? -0.1 * w : 0},0) scale(.90)`
        );

    //we have to manually draw/attach legend b/c display legend is a react component
    const legend = clonedSvg
        .select('g.container')
        .append('g')
        .attr('transform', () =>
            hasOrdinalScale
                ? `translate(${w / 2}, 0)`
                : `translate(${w / 2 - 220}, ${h / 2 - 10})`
        )
        .attr('class', 'legend');

    if (hasOrdinalScale) {
        legend
            .selectAll('g.item')
            .data(colorScale.domain())
            .join('g')
            .each(function (_, i) {
                const g = select<SVGGElement | BaseType, string>(this)
                    .attr('class', 'item')
                    .attr('transform', `translate(0, ${i * 15})`);

                g.append('circle')
                    .text(d => d)
                    .attr('r', 4)
                    .attr('cy', -6)
                    .attr('fill', d => colorScale(d));

                g.append('text')
                    .text(d => d)
                    .style('font-size', textHeight)
                    .attr('dx', 5);
            });
    } else {
        const gradient = legend
            .append('linearGradient')
            .attr('id', 'scaleGradientDownload');
        gradient
            .append('stop')
            .attr('offset', '5%')
            .attr('stop-color', colorScale.range()[0]);
        gradient
            .append('stop')
            .attr('offset', '95%')
            .attr(
                'stop-color',
                colorScale.range()[colorScale.range().length - 1]
            );

        legend
            .append('text')
            .text(colorScale.domain()[0])
            .style('font-size', textHeight)
            .attr('text-anchor', 'end')
            .attr('transform', `translate(-10, ${textHeight})`);

        legend
            .append('rect')
            .attr('fill', "url('#scaleGradientDownload')")
            .attr('height', 25)
            .attr('width', 200);

        legend
            .append('text')
            .style('font-size', textHeight)
            .attr('text-anchor', 'start')
            .attr('transform', `translate(210, ${textHeight})`)
            .text(colorScale.domain()[colorScale.domain().length - 1]);
    }

    return `data:image/svg+xml;base64,\n${window.btoa(clonedParent.innerHTML)}`;
};

export const downloadPng = (
    colorScale: ScaleOrdinal<string, string> | ScaleThreshold<any, any>
) => {
    const w = (select('svg').node() as Element).clientWidth;
    const h = (select('svg').node() as Element).clientHeight;

    const src = getSvgSrc(colorScale);

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
    colorScale: ScaleOrdinal<string, string> | ScaleThreshold<any, any>
) => {
    const svgSrc = getSvgSrc(colorScale);
    saveAs(svgSrc);
};
