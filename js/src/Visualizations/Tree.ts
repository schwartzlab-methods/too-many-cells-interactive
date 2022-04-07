import 'd3-transition'; // must be imported before selection
import { dispatch } from 'd3-dispatch';
import { BaseType, select, selectAll, Selection } from 'd3-selection';
import {
    HierarchyNode,
    HierarchyPointLink,
    HierarchyPointNode,
    tree,
} from 'd3-hierarchy';
import { arc, pie, pointRadial } from 'd3-shape';
import { ScaleLinear, scaleLinear, ScaleOrdinal, scaleOrdinal } from 'd3-scale';
import { extent, max, min, quantile, sum } from 'd3-array';
import { zoom } from 'd3-zoom';
import { schemePaired } from 'd3-scale-chromatic';
import { rgb } from 'd3-color';
import { format } from 'd3-format';
import { D3DragEvent, drag, DragBehavior } from 'd3-drag';
import { buildTree, carToRadius, carToTheta, getMAD, squared } from './../util';
import { TMCNode } from './../types';
import { BaseTreeContext } from '../Components/Dashboard/Dashboard';

// for debugging
(window as any).select = select;

type Point = [number, number];

/**
 *
 * @param d Offset length
 * @param m Slope of intersecting line
 * @returns [x,y] Absolute value of offsets for a line of length `d` perpendicular to a line with slope `m`
 */
const getPerpendicularOffsetCoords = (d: number, m: number): Point => {
    /* Pyth. theorum */

    const invertedSlope = -1 / m;

    const xOffset = Math.sqrt(squared(d) / (squared(invertedSlope) + 1));
    const yOffset = Math.sqrt(squared(d) - squared(xOffset));

    return [xOffset, yOffset];
};

const getSlope = (p1: Point, p2: Point) => (p2[1] - p1[1]) / (p2[0] - p1[0]);

/**
 * Get the "left" half the base
 *
 * @param midpoint the midpoint of the trapezoid base
 * @param m the slope to which the base will be perpendicular
 * @param offsets the x and y offsets for the perpendicular sides
 * @returns [x,y]
 */
const getSideA = (midpoint: Point, m: number, offsets: Point): Point => {
    const [midx, midy] = midpoint;
    const [offsetX, offsetY] = offsets;
    /* b/c chart "grows" outward from the center, x offsets will always be +/-, but y will differ with slope */
    const retX = midx - offsetX;
    const retY = m > 0 ? midy + offsetY : midy - offsetY;
    return [retX, retY];
};

/**
 * Get the "right" half of the base
 *
 * @param midpoint the midpoint of the trapezoid base
 * @param m the slope to which the base will be perpendicular
 * @param offsets the x and y offsets for the perpendicular sides
 * @returns [x,y]
 */
const getSideB = (midpoint: Point, m: number, offsets: Point): Point => {
    const [midx, midy] = midpoint;
    const [offsetX, offsetY] = offsets;
    const retX = midx + offsetX;
    const retY = m > 0 ? midy - offsetY : midy + offsetY;

    return [retX, retY];
};

/**
 *
 * @param point midpoint of trapezoid base
 * @param offset length of base / 2
 * @param m slope of line to which base is perpendicular
 * @returns [[x1,y1],[x2,y2]]
 */
const getBaseCoordsFromOffset = (
    point: Point,
    offsets: Point,
    m: number
): [Point, Point] => {
    const aSide = getSideA(point, m, offsets);
    const bSide = getSideB(point, m, offsets);
    return [aSide, bSide];
};

/**
 *
 * @param p1 Coordinates of point A
 * @param p2 Coordinates of point B
 * @param offsetLengthP1 Length of trap. base 1, drawn through point 1 and perpendicular to AB
 * @param offsetLengthP2 Length of trap. base 2, drawn through point 2 and perpendicular to AB
 * @returns Array of coordinates that can be stringified and passed to the polygon `points` attribute
 */
const drawScaledTrapezoid = (
    p1: Point,
    p2: Point,
    offsetLengthP1: number,
    offsetLengthP2: number
): [Point, Point, Point, Point] => {
    /* Calculate slope  */
    const m = getSlope(p1, p2);

    /* get distance from each point on perpendicular slope */
    const p1Offsets = getPerpendicularOffsetCoords(offsetLengthP1, m);
    const p2Offsets = getPerpendicularOffsetCoords(offsetLengthP2, m);

    const base1Coords = getBaseCoordsFromOffset(p1, p1Offsets, m);
    const base2Coords = getBaseCoordsFromOffset(p2, p2Offsets, m);

    /* reverse to keep shape open */
    base2Coords.reverse();

    return [...base1Coords, ...base2Coords];
};

type BlendArg = { color: string; weight: number };

const blendWeighted = (colors: BlendArg[]) => {
    const { r, b, g } = colors.reduce(
        (acc, curr) => {
            const { r, g, b } = rgb(curr.color);
            acc.r += r * curr.weight;
            acc.g += g * curr.weight;
            acc.b += b * curr.weight;
            return acc;
        },
        { r: 0, g: 0, b: 0 }
    );
    const weightSum = colors.reduce((acc, curr) => (acc += curr.weight), 0);

    return rgb(r / weightSum, g / weightSum, b / weightSum);
};

/* For distance markers */
const arcPath = arc()({
    innerRadius: 20,
    outerRadius: 20,
    startAngle: 0,
    endAngle: Math.PI * 2,
});

const getPie = (data: [string, number][]) =>
    pie<[string, number]>().value(d => d[1])(data);

const getBlendArgs = (
    labelCounts: Record<string, number>,
    labelScale: ScaleOrdinal<string, string>
) => {
    const ret: { color: string; weight: number }[] = [];
    for (let label in labelCounts) {
        let colorsWithWeights = {} as {
            color: string;
            weight: number;
        };
        colorsWithWeights.color = labelScale(label);
        colorsWithWeights.weight = labelCounts[label];
        ret.push(colorsWithWeights);
    }
    return ret;
};

const getBlendedColor = (
    labelCounts: Record<string, number>,
    labelScale: ScaleOrdinal<string, string>
) => {
    const weightedColors = getBlendArgs(labelCounts, labelScale);
    return blendWeighted(weightedColors).toString();
};

const showToolTip = (data: TMCNode, e: MouseEvent) => {
    selectAll('.tooltip')
        .html(function () {
            const total = sum(Object.values(data.labelCount));
            const f = format('.1%');

            return `${Object.entries(data.labelCount)
                .sort(([_, v1], [__, v2]) => (v1 < v2 ? 1 : -1))
                .reduce(
                    (acc, [k, v]) =>
                        `${acc}<strong>${k}</strong>: ${v} (${f(
                            v / total
                        )})<br/>`,
                    ''
                )}<hr/><strong>Distance</strong>: ${data.distance}`;
        })
        .style('visibility', 'visible')
        .style('left', `${e.pageX + 15}px`)
        .style('top', `${e.pageY - 15}px`);
};

const makeLinkId = (link: HierarchyPointLink<TMCNode>) =>
    `${link.source.data.nodeId}-${link.target.data.nodeId}-${!!link.source
        .children}`;

const deltaBehavior = dispatch('nodeDelta', 'linkDelta');

class RadialTree implements BaseTreeContext {
    branchDragBehavior: DragBehavior<SVGPolygonElement, any, any>;
    branchSizeScale: ScaleLinear<number, number>;
    container: Selection<SVGGElement, unknown, HTMLElement, any>;
    distanceScale: ScaleLinear<number, number>;
    distanceVisible = false;
    h = 1000;
    //labelScale = scaleOrdinal(['#66C2A5', '#EF966E']).domain(labels);
    labelScale: ScaleOrdinal<string, string>;
    legendSelector: string;
    linkContainer: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    links?: Selection<SVGGElement, HierarchyPointLink<TMCNode>, any, any>;
    nodeDragBehavior: DragBehavior<
        SVGGElement,
        HierarchyPointNode<TMCNode>,
        unknown
    >;
    nodes?: Selection<SVGGElement, HierarchyPointNode<TMCNode>, any, any>;
    nodeIdsVisible = false;
    nodeCountsVisible = false;
    nodeContainer: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    piesVisible = true;
    rootPositionedTree: HierarchyPointNode<TMCNode>;
    visibleNodes: HierarchyPointNode<TMCNode>;
    selector: string;
    strokeVisible = false;
    svg: Selection<SVGSVGElement, unknown, HTMLElement, any>;
    transitionTime = 250;
    w = 1000;
    constructor(
        selector: string,
        legendSelector: string,
        tree: HierarchyNode<TMCNode>
    ) {
        this.selector = selector;
        this.legendSelector = legendSelector;

        this.svg = select(this.selector)
            .append('svg')
            .attr('viewBox', [-this.w / 2, -this.h / 2, this.w, this.h]);

        this.container = this.svg
            .append('g')
            .attr('class', 'container')
            .attr('stroke-width', '1px');

        this.rootPositionedTree = buildTree(tree, this.w);
        this.visibleNodes = buildTree(tree, this.w);

        this.branchSizeScale = scaleLinear([0.1, 22]).domain(
            extent(tree.descendants().map(d => d.value!)) as [number, number]
        );

        this.distanceScale = scaleLinear([0, 1]).domain(
            extent(tree.descendants().map(d => +(d.data.distance || 0))) as [
                number,
                number
            ]
        );

        this.linkContainer = this.container
            .append('g')
            .attr('class', 'link-container')
            .attr('fill', 'none');

        this.nodeContainer = this.container
            .append('g')
            .attr('class', 'node-container')
            .attr('stroke-opacity', 0.8);

        const zoomBehavior = zoom<SVGSVGElement, unknown>().on('zoom', e =>
            this.container.attr('transform', e.transform.toString())
        );

        zoomBehavior(this.svg);

        /* Append tooltip */
        select(this.selector)
            .append('div')
            .attr('class', 'tooltip')
            .style('z-index', 999)
            .style('position', 'absolute')
            .style('background-color', 'black')
            .style('font-size', '10px')
            .style('color', 'white')
            .style('border-radius', '5px')
            .style('padding', '5px');

        const that = this;

        this.branchDragBehavior = drag<SVGPolygonElement, any>()
            .on(
                'start',
                function (
                    event: D3DragEvent<
                        SVGGElement,
                        HierarchyPointLink<TMCNode>,
                        any
                    >,
                    datum: HierarchyPointLink<TMCNode>
                ) {
                    const targetNode = that.nodeContainer
                        .selectAll<SVGGElement, HierarchyPointNode<TMCNode>>(
                            'g'
                        )
                        .filter(g => g.data.id === datum.target.data.id);

                    /* Get ids of all descendants of the target node */
                    const descIds = targetNode
                        .datum()
                        .descendants()
                        .map(d => d.data.nodeId);

                    const subtreeNodes = that.nodeContainer
                        .selectAll<SVGGElement, HierarchyPointNode<TMCNode>>(
                            'g.node'
                        )
                        .filter(d => descIds.includes(d.data.nodeId));

                    const subtreeLinks = that.linkContainer
                        .selectAll<SVGGElement, HierarchyPointLink<TMCNode>>(
                            'polygon'
                        )
                        .filter(
                            d =>
                                descIds.includes(d.target.data.nodeId) ||
                                descIds.includes(d.source.data.nodeId)
                        );

                    deltaBehavior.on(
                        'linkDelta',
                        function (dx: number, dy: number) {
                            subtreeNodes.attr('transform', function (d) {
                                const { e: xt, f: yt } = select<any, any>(this)
                                    .node()
                                    .transform.baseVal.consolidate().matrix;

                                const cart = pointRadial(d.x, d.y);

                                const newX = cart[0] + dx;
                                const newY = cart[1] + dy;

                                // update the layout values while we're here (d3 gives in polar coordinates) to keep updates insync
                                d.x = carToTheta(newX, newY);
                                d.y = carToRadius(newX, newY);

                                /* shift targetnode */
                                return `translate(${xt + dx}, ${yt + dy})`;
                            });

                            /* redraw trapezoid link with updated coords*/
                            subtreeLinks.attr(
                                'points',
                                (d: HierarchyPointLink<TMCNode>) =>
                                    drawScaledTrapezoid(
                                        pointRadial(d.source.x, d.source.y),
                                        pointRadial(d.target.x, d.target.y),
                                        that.branchSizeScale(d.source.value!),
                                        that.branchSizeScale(d.target.value!)
                                    ).toString()
                            );
                        }
                    );
                }
            )
            .on(
                'drag',
                (
                    event: D3DragEvent<
                        SVGGElement,
                        HierarchyPointNode<TMCNode>,
                        any
                    >
                ) => {
                    const { dx, dy } = event;
                    deltaBehavior.apply('linkDelta', undefined, [dx, dy]);
                }
            )
            .on('end', () => deltaBehavior.on('linkDelta', null));

        this.nodeDragBehavior = drag<SVGGElement, any>()
            .on('start', (_, datum: HierarchyPointNode<TMCNode>) => {
                const parentLink = that.linkContainer
                    .selectAll<SVGPolygonElement, HierarchyPointLink<TMCNode>>(
                        'polygon'
                    )
                    .filter(g => g.target.data.id === datum.data.id);

                deltaBehavior.on('nodeDelta', (x: number, y: number) =>
                    parentLink.attr('points', d =>
                        drawScaledTrapezoid(
                            pointRadial(d.source.x, d.source.y),
                            [x, y],
                            that.branchSizeScale(d.source.value!),
                            that.branchSizeScale(d.target.value!)
                        ).toString()
                    )
                );
            })
            .on(
                'drag',
                function (
                    event: D3DragEvent<
                        SVGGElement,
                        HierarchyPointNode<TMCNode>,
                        any
                    >,
                    datum: HierarchyPointNode<TMCNode>
                ) {
                    const { dx, dy } = event;
                    const { e: x, f: y } = select<any, any>(this)
                        .node()
                        .transform.baseVal.consolidate().matrix;

                    const car = pointRadial(datum.x, datum.y);

                    datum.x = carToTheta(dx + car[0], dy + car[1]);
                    datum.y = carToRadius(dx + car[0], dy + car[1]);

                    select(this).attr(
                        'transform',
                        `translate(${x + dx}, ${y + dy})`
                    );
                    deltaBehavior.apply('nodeDelta', undefined, [
                        dx + x,
                        dy + y,
                    ]);
                }
            )
            .on('end', () => deltaBehavior.on('nodeDelta', null));

        //need to grab all the labels off the nodes

        const labels = Array.from(
            new Set(
                this.rootPositionedTree
                    .descendants()
                    .flatMap(d => d.data.items?.map(d => d._barcode?.unCell))
            )
        ).filter(Boolean) as string[];

        this.labelScale = scaleOrdinal(schemePaired).domain(labels);
    }

    drawNodeCounter = () => {
        this.svg
            .selectAll<SVGGElement, Record<string, number>>('g.node-counter')
            .data(
                [
                    {
                        nodes: this.visibleNodes.descendants().length,
                        leaves: this.visibleNodes.leaves().length,
                        minVal: min(
                            this.visibleNodes.descendants().map(d => d.value!)
                        ),
                        maxVal: max(
                            this.visibleNodes.descendants().map(d => d.value!)
                        ),
                    },
                ],
                Math.random
            )
            .join('g')
            .attr('class', 'node-counter')
            .attr(
                'transform',
                `translate(${this.w / 2 - 150},${-this.h / 2 + 15})`
            )
            .append('text')
            .append('tspan')
            .text(d => `Node count: ${d.nodes}`)
            .append('tspan')
            .attr('dy', 15)
            .attr('x', 0)
            .text(d => `Leaf count: ${d.leaves}`)
            .append('tspan')
            .attr('dy', 15)
            .attr('x', 0)
            .text(d => `Min val: ${d.minVal}`)
            .append('tspan')
            .attr('dy', 15)
            .attr('x', 0)
            .text(d => `Max val: ${d.maxVal}`);
    };

    drawLegend = () =>
        select(this.legendSelector)
            .selectAll('ul')
            .data([1])
            .join('ul')
            .style('list-style-type', 'none')
            .style('padding', '0px')
            .selectAll<HTMLLIElement, string>('li')
            .data(this.labelScale.domain())
            .join('li')
            .selectAll('span')
            .data(d => [d])
            .join('span')
            .style('height', '15px')
            .style('width', '15px')
            .style('margin-bottom', '5px')
            .style('cursor', 'pointer')
            .style('border-radius', '50%')
            .style('display', 'inline-block')
            .style('background-color', d => this.labelScale(d))
            .on('click', (_, name) =>
                document.getElementById(`picker-${name}`)?.click()
            )
            .append('span')
            .style('margin-left', '20px')
            .text(d => d)
            .append('input')
            .attr('id', 'picker')
            .attr('type', 'color')
            .style('position', 'absolute')
            .attr('id', name => `picker-${name}`)
            .style('height', 0)
            .style('opacity', '0')
            .style('width', 0)
            .on('input', (a, b) => {
                const idx = this.labelScale.domain().findIndex(i => i === b);
                this.labelScale.range(
                    this.labelScale
                        .range()
                        .map((o, i) => (i === idx ? a.target.value : o))
                );
                this.render();
            });

    toggleStroke = () => {
        Object.assign(this, { strokeVisible: !this.strokeVisible });
        this.render();
    };

    toggleDistance = () => {
        this.distanceVisible = !this.distanceVisible;
        this.svg
            .selectAll('path.distance')
            .style('visibility', this.distanceVisible ? 'visible' : 'hidden');
    };

    toggleNodeCounts = () => {
        this.nodeCountsVisible = !this.nodeCountsVisible;
        this.svg
            .selectAll('.node-count')
            .style('visibility', this.nodeCountsVisible ? 'visible' : 'hidden');
    };

    toggleNodeIds = () => {
        this.nodeIdsVisible = !this.nodeIdsVisible;
        this.svg
            .selectAll('.node-id')
            .style('visibility', this.nodeIdsVisible ? 'visible' : 'hidden');
    };

    togglePies = () => {
        this.piesVisible = !this.piesVisible;
        this.svg
            .selectAll('.pie')
            .style('visibility', this.piesVisible ? 'visible' : 'hidden');
    };

    /* todo: why is add label scale not triggering rerender? why do nodes rerender every time? */
    renderLinks = (
        selection: Selection<
            SVGGElement,
            HierarchyPointLink<TMCNode>,
            any,
            unknown
        >
    ) => {
        const gradients = this.container
            .selectAll<BaseType, HierarchyPointLink<TMCNode>>('linearGradient')
            .data(
                this.visibleNodes.links(),
                // (d: HierarchyPointLink<TMCNode>) =>
                //     `${makeLinkId(d)}-${this.labelScale.range().join(' ')}`
                (d: HierarchyPointLink<TMCNode>) => Math.random()
            )
            .join('linearGradient')
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', d => pointRadial(d.source.x, d.source.y)[0])
            .attr('y1', d => pointRadial(d.source.x, d.source.y)[1])
            .attr('x2', d => pointRadial(d.target.x, d.target.y)[0])
            .attr('y2', d => pointRadial(d.target.x, d.target.y)[1])
            .attr('id', d => `${d.source.data.id}-${d.target.data.id}`);

        gradients
            .append('stop')
            .attr('offset', '40%')
            .attr('stop-color', d =>
                getBlendedColor(d.source.data.labelCount, this.labelScale)
            );

        gradients
            .append('stop')
            .attr('offset', '85%')
            .attr('stop-color', d =>
                getBlendedColor(d.target.data.labelCount, this.labelScale)
            );

        return selection
            .selectAll<SVGPolygonElement, HierarchyPointLink<TMCNode>>(
                'polygon.link'
            )
            .data(
                d => [d],
                d => makeLinkId(d)
            )
            .join(
                enter => {
                    return enter
                        .append('polygon')
                        .attr('class', 'link')
                        .attr('points', d =>
                            drawScaledTrapezoid(
                                pointRadial(d.source.x, d.source.y),
                                pointRadial(d.source.x, d.source.y).map(
                                    d => d + 0.1
                                ) as Point,
                                0,
                                0
                            ).toString()
                        )
                        .call(this.branchDragBehavior)
                        .transition()
                        .delay(this.transitionTime * 2)
                        .duration(this.transitionTime)
                        .attr('points', d => {
                            return drawScaledTrapezoid(
                                pointRadial(d.source.x, d.source.y),
                                pointRadial(d.target.x, d.target.y),
                                this.branchSizeScale(d.source.value!),
                                this.branchSizeScale(d.target.value!)
                            ).toString();
                        });
                },

                update =>
                    update
                        .transition()
                        .delay(this.transitionTime)
                        .duration(this.transitionTime)
                        .attr('points', d =>
                            drawScaledTrapezoid(
                                pointRadial(d.source.x, d.source.y),
                                pointRadial(d.target.x, d.target.y),
                                this.branchSizeScale(d.source.value!),
                                this.branchSizeScale(d.target.value!)
                            ).toString()
                        ),
                exit =>
                    exit
                        .transition()
                        .duration(this.transitionTime)
                        .attr('points', d =>
                            drawScaledTrapezoid(
                                pointRadial(d.source.x, d.source.y),
                                pointRadial(d.source.x, d.source.y).map(
                                    d => d + 0.1
                                ) as Point,
                                0,
                                0
                            ).toString()
                        )
                        .remove()
            )
            .attr('stroke', this.strokeVisible ? 'black' : 'none')
            .attr(
                'fill',
                d => `url('#${d.source.data.id}-${d.target.data.id}')`
            );
    };

    render = () => {
        const pieScale = scaleLinear([5, 20]).domain(
            extent(this.visibleNodes.leaves().map(d => d.value!)) as [
                number,
                number
            ]
        );

        const textSizeScale = scaleLinear([10, 40]).domain(
            extent(this.visibleNodes.leaves().map(d => d.value!)) as [
                number,
                number
            ]
        );

        this.nodes = this.nodeContainer
            .selectAll<SVGGElement, HierarchyPointNode<TMCNode>>('g.node')
            .data(this.visibleNodes.descendants(), d => d.data.nodeId)
            .join(
                enter => {
                    const that = this;
                    return (
                        enter
                            .append('g')
                            .attr('class', 'node')
                            .attr('opacity', 0)
                            .attr(
                                'transform',
                                d => `translate(${pointRadial(d.x, d.y)})`
                            )
                            .on(
                                'mouseover',
                                (e: MouseEvent, d: HierarchyNode<TMCNode>) =>
                                    showToolTip(d.data, e)
                            )
                            .on('mouseout', () =>
                                selectAll('.tooltip').style(
                                    'visibility',
                                    'hidden'
                                )
                            )
                            .transition()
                            //.delay(this.transitionTime * 2)
                            .duration(this.transitionTime)
                            .attr('opacity', 1)
                            .each(function (d) {
                                if (!d.children) {
                                    select<
                                        SVGGElement,
                                        HierarchyPointNode<TMCNode>
                                    >(this).call(that.nodeDragBehavior);
                                } else {
                                    select(this).on('mousedown.drag', null);
                                }
                            })
                    );
                },
                update => {
                    const that = this;
                    return update
                        .transition()
                        .delay(this.transitionTime)
                        .duration(this.transitionTime)
                        .attr(
                            'transform',
                            d => `translate(${pointRadial(d.x, d.y)})`
                        )
                        .each(function (d) {
                            if (!d.children) {
                                select<
                                    SVGGElement,
                                    HierarchyPointNode<TMCNode>
                                >(this).call(that.nodeDragBehavior);
                            } else {
                                select(this).on('mousedown.drag', null);
                            }
                        });
                },
                exit => exit.remove()
            );

        this.links = this.linkContainer
            .selectAll<SVGGElement, HierarchyPointLink<TMCNode>>('g.link')
            .data(this.visibleNodes.links(), d => makeLinkId(d))
            .join('g')
            .attr('class', 'link');

        this.links
            .call(this.renderLinks)
            .selectAll<SVGPolygonElement, HierarchyPointLink<TMCNode>>(
                'polygon'
            )
            .on('mouseover', (e: MouseEvent, d: HierarchyPointLink<TMCNode>) =>
                showToolTip(d.target.data, e)
            )
            .on('mouseout', () =>
                selectAll('.tooltip').style('visibility', 'hidden')
            )
            .attr('stroke', this.strokeVisible ? 'black' : 'none');

        /* append nodes */
        this.nodes
            .selectAll<SVGPathElement, HierarchyPointNode<TMCNode>>(
                'circle.node'
            )
            //need to wrap datum to prevent d3 from calling Array.from() on node and returning all descendants!
            .data((d: HierarchyPointNode<TMCNode>) => [d])
            .join('circle')
            .attr('class', 'node')
            .attr('stroke', this.strokeVisible ? 'black' : 'none')
            .attr('fill', d =>
                d.children
                    ? getBlendedColor(d.data.labelCount, this.labelScale)
                    : null
            )
            .attr('r', d =>
                d.children ? this.branchSizeScale(d.value || 0) : 0
            );

        /* append node ids */
        this.nodes
            .selectAll<SVGTextElement, HierarchyPointNode<TMCNode>>(
                'text.node-id'
            )
            .data(d => [d])
            .join('text')
            .style('cursor', 'pointer')
            .attr('class', 'node-id')
            .text(d => d.data.nodeId)
            .attr('text-anchor', 'middle')
            .style('visibility', this.nodeIdsVisible ? 'visible' : 'hidden');

        /* LEAF ADORNMENTS */

        /* item counts */
        this.nodes
            .selectAll('text.node-count')
            .data(d => [d])
            .join('text')
            .style('cursor', 'pointer')
            .style('font-size', d => textSizeScale(d.value!))
            .attr('class', 'node-count')
            .text(d => (!!d.children ? null : d.value!))
            .attr('text-anchor', 'middle')
            .style('visibility', this.nodeCountsVisible ? 'visible' : 'hidden');

        /* pies */

        const that = this;
        this.nodes
            .selectAll('g.pie')
            .data(d => [d])
            .join('g')
            .attr('class', 'pie')
            .style('cursor', 'pointer')
            .each(function (outer) {
                select(this)
                    .selectAll('path')
                    .attr('class', 'pie')
                    .data(
                        getPie(Object.entries(outer.data.labelCount)),
                        () => `${outer.data.nodeId}-${outer.data.children}`
                    )
                    .join('path')
                    .attr('stroke', 'none')
                    .transition()
                    .duration(that.transitionTime)
                    .attr('d', d =>
                        !outer.children
                            ? arc()({
                                  innerRadius: 0,
                                  outerRadius: pieScale(outer.value!),
                                  ...d,
                              })
                            : null
                    )

                    .attr('fill', d => that.labelScale(d.data[0]));
            })
            .style('visibility', this.piesVisible ? 'visible' : 'hidden');

        /* Append distance arcs --> have to go on top of everything */
        this.container
            .selectAll<SVGGElement, HierarchyPointNode<TMCNode>>(
                'path.distance'
            )
            .data(this.visibleNodes.descendants(), d => d.data.nodeId)
            .join('path')
            .on('mouseover', (e: MouseEvent, d: HierarchyNode<TMCNode>) =>
                showToolTip(d.data, e)
            )
            .on('mouseout', () =>
                selectAll('.tooltip').style('visibility', 'hidden')
            )
            .attr('class', 'distance')
            .style('visibility', this.distanceVisible ? 'visible' : 'hidden')
            .attr(
                'transform',
                d => `translate(${pointRadial(d.x, d.y).toString()})`
            )
            .attr('d', d => (d.children ? arcPath : null))
            .transition()
            .delay(this.transitionTime)
            .duration(this.transitionTime)
            .attr('stroke', 'black')
            .attr('opacity', d => this.distanceScale(d.data.distance || 0));

        this.drawLegend();
        this.drawNodeCounter();
    };
}

export default RadialTree;
