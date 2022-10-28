import { extent, max } from 'd3-array';
import { axisBottom, axisRight } from 'd3-axis';
import { brushX, BrushSelection, D3BrushEvent } from 'd3-brush';
import { NumberValue, ScaleLinear, scaleLinear } from 'd3-scale';
import { select, Selection } from 'd3-selection';
import { area, curveBasis } from 'd3-shape';
import { formatDigit } from '../util';

/* object representing a cumulative count for some value in a list of numbers*/
export interface CumSumBin {
    value: number;
    count: number;
}

/* assumes ascending order */
const bisectDownSorted = (arr: number[], target: number) => {
    let i = 0;
    while (target > arr[i + 1]) {
        i++;
    }
    return i;
};
export default class Histogram {
    /* We assume that these are already properly sorted [by .count, probably] */
    counts: CumSumBin[];
    h = 240;
    margin = 40;
    onBrush: (val: number) => void;
    selector: string;
    svg: Selection<SVGGElement, unknown, any, any>;
    title?: string;
    xLabel: string;
    xScale!: ScaleLinear<number, number>;
    w = 400;
    yScale!: ScaleLinear<number, number>;
    constructor(
        counts: CumSumBin[],
        onBrush: (val: number) => void,
        selector: string,
        xLabel: string,
        title?: string
    ) {
        this.counts = counts;
        this.onBrush = onBrush;
        this.selector = selector;
        this.svg = select(this.selector)
            .append('svg')
            .attr('viewBox', [0, 0, this.w, this.h])
            .append('g')
            .attr('class', 'container');

        this.title = title;

        this.xLabel = xLabel;
    }

    setBrush = (initialValue?: number) => {
        const that = this;
        let startX = 0;
        let selectedIdx: number;

        const binThresholds = this.counts.map(c => c.value);

        /* store starting location of each bin*/
        const ticks = binThresholds
            //.sort((a, b) => (a < b ? -1 : 1))
            .map(c => this.xScale(c));

        const brushed = function (this: SVGGElement, event: D3BrushEvent<any>) {
            if (!event.sourceEvent || !event.selection) return;

            /* "left" x value could be first or second position, depending on orientation to dragstart point */
            const _x0 =
                event.selection[0] >= startX
                    ? (event.selection[1] as number)
                    : (event.selection[0] as number);

            /* round down to the nearest bin  */
            const idx = bisectDownSorted(ticks, _x0);

            /* set brush x to nearest bin on left side */
            const x0 = ticks[idx];

            /* clamp brush range to rightmost value; the main visualization will always contain it b/c it corresponds to root*/
            const x2 = that.xScale.range()[1];

            /* fire callback if bin has changed */
            if (selectedIdx !== idx) {
                selectedIdx = idx;
                that.onBrush(that.xScale.invert(ticks[idx]));
            }

            brush.move(select(this), [x0, x2]);
        };

        const brush = brushX<null>()
            .extent([
                [this.margin, this.title ? this.margin : this.margin / 2],
                [this.w - this.margin, this.h - this.margin],
            ])
            .on('brush', brushed)
            .on(
                'start',
                ({ selection }: { selection: BrushSelection }) =>
                    (startX = selection ? (selection[0] as number) : 0)
            )
            .on('end', () => (startX = 0));

        this.svg
            .selectAll<SVGGElement, null>('g.brush-container')
            //initial value may be provided from outside
            .data([null])
            .join(enter =>
                enter
                    .append('g')
                    .attr('class', 'brush-container')
                    .call(brush)
                    .on('click', function () {
                        brush.move(select(this), [0, 0]);
                        that.onBrush(that.xScale.domain()[0]);
                    })
                    .call(brush.move, [
                        this.xScale(
                            initialValue ?? this.xScale.range().slice(-1)[0]
                        ),
                        this.xScale.range().slice(-1)[0],
                    ])
            );
    };

    /* Initialvalue is from upstream, may change over life of object if user manually changes input */
    render = (initialValue?: number) => {
        const bins = this.counts.map(c => c.value);

        this.xScale = scaleLinear([
            0 + this.margin + 12,
            this.w - this.margin,
        ]).domain(extent(bins) as [number, number]);

        this.xScale.tickFormat = () => (val: NumberValue) =>
            formatDigit(+val).toString();

        this.yScale = scaleLinear([
            this.h - this.margin,
            this.title ? this.margin : this.margin / 2,
        ])
            .domain([0, max(this.counts.map(v => v.count))] as [number, number])
            .nice();

        if (this.title) {
            this.svg
                .append('g')
                .attr('class', 'title')
                .attr(
                    'transform',
                    `translate(${this.margin}, ${this.margin / 2})`
                )
                .append('text')
                .text(this.title);
        }

        const areaG = area()
            .x(([k]) => this.xScale(k)!)
            .curve(curveBasis)
            //eslint-disable-next-line @typescript-eslint/no-unused-vars
            .y1(([_, v]) => this.yScale(v))
            .y0(this.yScale.range()[0]);

        this.svg
            .selectAll('path.area')
            .data([this.counts.map(c => [c.value, c.count])])
            .join('path')
            .attr('class', 'area')
            .transition()
            .duration(500)
            .attr('d', d => areaG(d.map(([d, e]) => [+d, e])))
            .attr('fill', '#009FFD');

        const maxTicks = 12;

        const ratio =
            bins.length > maxTicks ? Math.ceil(bins.length / maxTicks) : 1;

        const ticks = bins.filter((_, i) => !(i % ratio));

        this.svg
            .selectAll<any, any>('g.x-axis')
            .data([Math.random()])
            .join('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${this.h - this.margin})`)
            .transition()
            .duration(500)
            .call(
                axisBottom(this.xScale)
                    .tickSizeOuter(0)
                    .tickValues(ticks.map(t => +t))
            )
            .selection()
            .style('font-size', 8)
            .selectAll('g.x-label')
            .data([this.xLabel])
            .join('g')
            .attr('class', 'x-label')
            .attr('transform', `translate(${this.w / 2}, 30)`)
            .selectAll('text')
            .data(d => [d])
            .join('text')
            .text(d => d)
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .style('font-size', 12);

        this.svg
            .selectAll<any, any>('g.y-axis')
            .data([Math.random()])
            .join('g')
            .attr('class', 'y-axis')
            .attr('transform', 'translate(12,0)')
            .transition()
            .duration(500)
            .call(axisRight(this.yScale))
            .selection()
            .selectAll('g.y-label')
            .data(['Count'])
            .join('g')
            .attr('class', 'y-label')
            .selectAll('text')
            .data(d => [d])
            .join('text')
            .attr('transform', `translate(-12, ${this.h / 2}), rotate(90)`)
            .attr('fill', 'black')
            .attr('text-anchor', 'end')
            .text(d => d);

        this.setBrush(initialValue);
    };
}
