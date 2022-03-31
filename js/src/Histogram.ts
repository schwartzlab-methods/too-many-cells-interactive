import { extent } from 'd3-array';
import { axisBottom, axisLeft, axisRight } from 'd3-axis';
import { ScaleBand, scaleBand, ScaleLinear, scaleLinear } from 'd3-scale';
import { select, Selection } from 'd3-selection';

export default class Histogram {
    counts: Record<string | number, number>;
    selector: string;
    svg: Selection<SVGGElement, unknown, any, any>;
    w = 400;
    h = 200;
    margin = 35;
    title: string;
    yScale: ScaleLinear<number, number>;
    xScale: ScaleBand<string>;
    constructor(
        counts: Record<string | number, number>,
        selector: string,
        title: string
    ) {
        this.title = title;
        this.counts = counts;
        this.selector = selector;
        this.svg = select(this.selector)
            .append('svg')
            .attr('viewBox', [0, 0, this.w, this.h])
            .append('g')
            .attr('class', 'container');

        this.yScale = scaleLinear([this.h - this.margin, this.margin])
            .domain(extent(Object.values(this.counts)) as [number, number])
            .nice();

        this.xScale = scaleBand([0 + this.margin, this.w - this.margin]).domain(
            Object.keys(this.counts).map(d => d.toString())
        );
    }

    render = () => {
        this.svg
            .append('g')
            .attr('class', 'title')
            .attr('transform', `translate(${this.margin}, ${this.margin / 2})`)
            .append('text')
            .text(this.title);

        this.svg
            .selectAll('rect')
            .data(Object.entries(this.counts))
            .join('rect')
            .attr('x', d => this.xScale(d[0])!)
            .attr('y', d => this.yScale(d[1]))
            .attr('width', this.xScale.bandwidth() - 2)
            .attr('height', d => this.h - this.margin - this.yScale(d[1]));

        const maxTicks = 15;

        const ratio =
            this.xScale.domain().length > maxTicks
                ? Math.ceil(this.xScale.domain().length / maxTicks)
                : 1;

        const ticks = this.xScale.domain().filter((_, i) => !(i % ratio));

        this.svg
            .append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${this.h - this.margin})`)
            .call(axisBottom(this.xScale).tickSizeOuter(0).tickValues(ticks));

        this.svg.append('g').call(axisRight(this.yScale));
    };
}
