import { extent } from 'd3-array';
import { axisBottom, axisRight } from 'd3-axis';
import { brushX, BrushSelection, D3BrushEvent, brushSelection } from 'd3-brush';
import { ScaleLinear, scaleLinear } from 'd3-scale';
import { select, Selection } from 'd3-selection';
import { area, curveBasis } from 'd3-shape';

/* assumes ascending order */
const bisectDownSorted = (arr: number[], target: number) => {
    let i = 0;
    while (target > arr[i + 1]) {
        i++;
    }
    return i;
};
export default class Histogram {
    counts: Record<number, number>;
    selector: string;
    svg: Selection<SVGGElement, unknown, any, any>;
    w = 400;
    h = 200;
    margin = 35;
    onBrush: (val: number) => void;
    title: string;
    yScale: ScaleLinear<number, number>;
    xScale: ScaleLinear<number, number>;
    constructor(
        counts: Record<number, number>,
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

        this.xScale = scaleLinear([
            0 + this.margin,
            this.w - this.margin,
        ]).domain(
            extent(Object.keys(this.counts).map(d => +d)) as [number, number]
        );

        this.title = title;

        this.yScale = scaleLinear([this.h - this.margin, this.margin])
            .domain(extent(Object.values(this.counts)) as [number, number])
            .nice();
    }

    setBrush = () => {
        const that = this;
        let startX = 0;
        let selectedIdx: number;

        const counts = Object.keys(this.counts).map(Number);

        /* store starting location of each bin*/
        const ticks = counts.map(c => this.xScale(c));

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

        this.svg
            .append('g')
            .call(brush)
            .on('click', function () {
                brushSelection(this);
                brush.move(select(this), [0, 0]);
                that.onBrush(0);
            });
    };

    render = () => {
        const bins = Object.keys(this.counts);

        this.svg
            .append('g')
            .attr('class', 'title')
            .attr('transform', `translate(${this.margin}, ${this.margin / 2})`)
            .append('text')
            .text(this.title);

        const areaG = area()
            .x(([k]) => this.xScale(k)!)
            .curve(curveBasis)
            .y1(([_, v]) => this.yScale(v))
            .y0(this.yScale(0));

        this.svg
            .selectAll('path.area')
            .data([Object.entries(this.counts)])
            .join('path')
            .attr('class', 'area')
            // note that this is and other number casting is just to keep typescript happy, the key is already a number
            .attr('d', d => areaG(d.map(([d, e]) => [+d, e])));

        const maxTicks = 15;

        const ratio =
            bins.length > maxTicks ? Math.ceil(bins.length / maxTicks) : 1;

        const ticks = bins.filter((_, i) => !(i % ratio));

        this.svg
            .append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${this.h - this.margin})`)
            .call(
                axisBottom(this.xScale)
                    .tickSizeOuter(0)
                    .tickValues(ticks.map(t => +t))
            );

        this.svg.append('g').call(axisRight(this.yScale));

        this.setBrush();
    };
}
