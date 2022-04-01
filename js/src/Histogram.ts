import { extent } from 'd3-array';
import { axisBottom, axisRight } from 'd3-axis';
import { brushX, BrushSelection, D3BrushEvent } from 'd3-brush';
import { ScaleBand, scaleBand, ScaleLinear, scaleLinear } from 'd3-scale';
import { select, Selection } from 'd3-selection';

/* assumes ascending order */
const bisectDownSorted = (arr: number[], target: number) => {
    let i = 0;
    while (target > arr[i + 1]) {
        i++;
    }
    return i;
};

/* array from start to stop, inclusive, with size+1 members */
const ticksPrecise = (start: number, stop: number, size: number) => {
    const range = stop - start;
    const step = range / size;
    const res = [];
    for (let i = 0; i < size; i++) {
        res[i] = start + step * i;
    }
    res[size] = stop;
    return res;
};

export default class Histogram {
    barWidth: number;
    counts: Record<string | number, number>;
    selector: string;
    svg: Selection<SVGGElement, unknown, any, any>;
    w = 400;
    h = 200;
    margin = 35;
    onBrush: (val: number) => void;
    title: string;
    yScale: ScaleLinear<number, number>;
    xScale: ScaleBand<string>;
    constructor(
        counts: Record<string | number, number>,
        onBrush: (val: number) => void,
        selector: string,
        title: string
    ) {
        this.counts = counts;
        this.onBrush = onBrush;
        this.selector = selector;
        this.svg = select(this.selector)
            .append('svg')
            .attr('viewBox', [0, 0, this.w, this.h])
            .append('g')
            .attr('class', 'container');

        this.xScale = scaleBand([0 + this.margin, this.w - this.margin]).domain(
            Object.keys(this.counts).map(d => d.toString())
        );
        this.barWidth = this.xScale.bandwidth() - 2;

        this.title = title;

        this.yScale = scaleLinear([this.h - this.margin, this.margin])
            .domain(extent(Object.values(this.counts)) as [number, number])
            .nice();
    }

    setBrush = () => {
        const that = this;
        let startX = 0;
        let selectedIdx: number;

        const tickCount = that.xScale.domain().length;

        // poor man's inverted ordinal scale
        const ticks = ticksPrecise(
            that.xScale.range()[0],
            that.xScale.range()[1],
            tickCount
        );

        const brushed = function (this: SVGGElement, event: D3BrushEvent<any>) {
            if (!event.sourceEvent || !event.selection) return;

            const _x0 =
                event.selection[0] >= startX
                    ? (event.selection[1] as number)
                    : (event.selection[0] as number);

            const idx = bisectDownSorted(ticks, _x0);

            const x0 = ticks[idx];
            const x2 = that.xScale.range()[that.xScale.range().length - 1];

            if (selectedIdx !== idx) {
                selectedIdx = idx;
                that.onBrush(+that.xScale.domain()[idx]);
            }

            brush.move(select(this), [x0, x2]);
        };

        const brush = brushX()
            .extent([
                [this.margin, this.margin],
                [this.w - this.margin, this.h - this.margin],
            ])
            .on('brush', brushed)
            .on(
                'start',
                ({ selection }: { selection: BrushSelection }) =>
                    (startX = selection[0] as number)
            )
            .on('end', () => (startX = 0));

        this.svg.append('g').call(brush);
    };

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
            .attr('class', 'bar')
            .attr('x', d => this.xScale(d[0])!)
            .attr('y', d => this.yScale(d[1]))
            .attr('width', this.barWidth)
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

        this.setBrush();
    };
}
