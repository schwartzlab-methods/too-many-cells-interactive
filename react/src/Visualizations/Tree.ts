import 'd3-transition'; // must be imported before selection
import { extent, sum } from 'd3-array';
import { dispatch } from 'd3-dispatch';
import { rgb } from 'd3-color';
import { D3DragEvent, drag, DragBehavior } from 'd3-drag';
import { format } from 'd3-format';
import {
    HierarchyNode,
    HierarchyPointLink,
    HierarchyPointNode,
} from 'd3-hierarchy';
import { ScaleLinear, scaleLinear, ScaleOrdinal } from 'd3-scale';
import { BaseType, select, selectAll, Selection } from 'd3-selection';
import { arc, pie, pointRadial } from 'd3-shape';
import { zoom } from 'd3-zoom';
import {
    carToRadius,
    carToTheta,
    formatDistance,
    getEntries,
    squared,
} from '../util';
import { AttributeMap, AttributeMapValue, isLinkNode, TMCNode } from '../types';
import { ClickPruner } from '../Components/Dashboard/Dashboard';
import { ContextManager } from '../Components/Dashboard/Chart/TreeComponent';

// for debugging
(window as any).select = select;

type Point = [number, number];

const getColor = (
    scale: ScaleOrdinal<string, string>,
    colorScaleKey: 'featureCount' | 'labelCount',
    node: HierarchyPointNode<TMCNode>
) => {
    const colorSource = node.data[colorScaleKey];

    return getBlendedColor(colorSource, scale).toString();
};

const getBlendedColor = (
    counts: AttributeMap,
    scale: ScaleOrdinal<string, string>
) => {
    const weightedColors = Object.values(counts).map<BlendArg>(v => ({
        //it's possible for weight to be zero, in which case we'll get black, so well set at one
        //this is mainly for enrichment
        weight: v.quantity || 1,
        color: scale(v.scaleKey),
    }));
    //rgb
    const color = blendWeighted(weightedColors);
    return color.toString();
};

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
 * @param offsets length of base / 2
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

/* For distance markers */
const arcPath = arc()({
    innerRadius: 20,
    outerRadius: 20,
    startAngle: 0,
    endAngle: Math.PI * 2,
});

const getPie = (data: [string, AttributeMapValue][]) =>
    pie<[string, AttributeMapValue]>().value(d => d[1].quantity || 1)(data);

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

const showToolTip = (data: TMCNode, e: MouseEvent) => {
    const cellCount = sum(Object.values(data.labelCount).map(v => v.quantity));
    const f = format('.1%');
    const ff = format('.5');

    const container = select('.tooltip')
        .style('left', `${e.pageX + 15}px`)
        .style('top', `${e.pageY - 15}px`)
        .style('visibility', 'visible');

    const inner = container.select('.inner');

    const tissueContainer = inner.select('div.tissue ul');

    tissueContainer
        .selectAll('li.item')
        .data(
            getEntries(data.labelCount).sort((a, b) =>
                a[1].quantity < b[1].quantity ? 1 : -1
            ),
            Math.random
        )
        .join('li')
        .attr('class', 'item')
        .each(function (d) {
            const s = select(this).append('span');
            const strong = s.append('strong');
            strong.html(`${d[1].scaleKey}: `);
            const val = s.append('span');
            val.html(f(d[1].quantity / cellCount));
        });

    if (Object.keys(data.featureCount).length) {
        tissueContainer.style('border-right', 'thin white solid');
    } else {
        tissueContainer.style('border-right', 'none');
    }

    const featuresContainer = inner.select('div.features ul');

    featuresContainer
        .selectAll('li.item')
        .data(
            getEntries(data.featureCount).sort((a, b) =>
                a[1].quantity < b[1].quantity ? 1 : -1
            ),
            Math.random
        )
        .join('li')
        .attr('class', 'item')
        .each(function (d) {
            const s = select(this).append('span');
            const strong = s.append('strong');
            strong.html(`${d[1].scaleKey}: `);
            const val = s.append('span');
            val.html(ff(d[1].quantity));
        });

    container.selectAll('hr').data([1]).join('hr');

    container
        .selectAll('div.distance')
        .data([data.distance])
        .join('div')
        .attr('class', 'distance')
        .html(
            d =>
                `<strong>Distance:&nbsp;</strong> ${
                    d ? formatDistance(d) : 'null'
                }`
        );
};

const makeLinkId = (link: HierarchyPointLink<TMCNode>) =>
    `${link.source.data.nodeId}-${link.target.data.nodeId}-${!!link.source
        .children}`;

const deltaBehavior = dispatch('nodeDelta', 'linkDelta');

class RadialTree {
    branchDragBehavior: DragBehavior<SVGPolygonElement, any, any>;
    container: Selection<SVGGElement, unknown, HTMLElement, any>;
    ContextManager: ContextManager;
    distanceScale: ScaleLinear<number, number>;
    h = 1000;
    legendSelector: string;
    linkContainer: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    links?: Selection<SVGGElement, HierarchyPointLink<TMCNode>, any, any>;
    nodeDragBehavior: DragBehavior<
        SVGGElement,
        HierarchyPointNode<TMCNode>,
        unknown
    >;
    nodes?: Selection<SVGGElement, HierarchyPointNode<TMCNode>, any, any>;
    nodeContainer: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    selector: string;
    svg: Selection<SVGSVGElement, unknown, HTMLElement, any>;
    transitionTime = 250;
    constructor(
        ContextManager: ContextManager,
        legendSelector: string,
        selector: string
    ) {
        const that = this;

        this.selector = selector;
        this.legendSelector = legendSelector;

        this.ContextManager = ContextManager;

        this.svg = select(this.selector)
            .append('svg')
            .attr('viewBox', [
                -this.ContextManager.displayContext.w / 2,
                -this.h / 2,
                this.ContextManager.displayContext.w,
                this.h,
            ]);

        this.container = this.svg
            .append('g')
            .attr('class', 'container')
            .attr('stroke-width', '1px');

        this.distanceScale = scaleLinear([0, 1]).domain(
            extent(
                this.ContextManager.displayContext.rootPositionedTree
                    .descendants()
                    .map(d => +(d.data.distance || 0))
            ) as [number, number]
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
        const tt = select('body')
            .append('div')
            .attr('class', 'tooltip')
            .style('z-index', 999)
            .style('position', 'absolute')
            .style('background-color', 'black')
            .style('font-size', '10px')
            .style('color', 'white')
            .style('border-radius', '5px')
            .style('padding', '5px');

        const innerContainer = tt
            .append('div')
            .attr('class', 'inner')
            .style('display', 'flex');

        innerContainer
            .append('div')
            .attr('class', 'tissue')
            .append('ul')
            .style('list-style-type', 'none')
            .style('margin', '0px')
            .style('padding', '5px');

        innerContainer
            .append('div')
            .attr('class', 'features')
            .append('ul')
            .style('list-style-type', 'none')
            .style('margin', '0px')
            .style('padding', '5px');

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
                                        that.ContextManager.displayContext.branchSizeScale(
                                            d.source.value!
                                        ),
                                        that.ContextManager.displayContext.branchSizeScale(
                                            d.target.value!
                                        )
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
                            that.ContextManager.displayContext.branchSizeScale(
                                d.source.value!
                            ),
                            that.ContextManager.displayContext.branchSizeScale(
                                d.target.value!
                            )
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
    }

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
                this.ContextManager.displayContext.visibleNodes.links(),
                // (d: HierarchyPointLink<TMCNode>) =>
                //     `${makeLinkId(d)}-${this.colorScale.range().join(' ')}`
                () => Math.random()
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
                getColor(
                    this.ContextManager.displayContext.colorScale,
                    this.ContextManager.displayContext.colorScaleKey,
                    d.source
                )
            );

        gradients
            .append('stop')
            .attr('offset', '85%')
            .attr('stop-color', d =>
                getColor(
                    this.ContextManager.displayContext.colorScale,
                    this.ContextManager.displayContext.colorScaleKey,
                    d.target
                )
            );

        const { branchSizeScale } = this.ContextManager.displayContext;

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
                                branchSizeScale(d.source.value!),
                                branchSizeScale(d.target.value!)
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
                                branchSizeScale(d.source.value!),
                                branchSizeScale(d.target.value!)
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
            .attr(
                'stroke',
                this.ContextManager.displayContext.strokeVisible
                    ? 'black'
                    : 'none'
            )
            .attr(
                'fill',
                d => `url('#${d.source.data.id}-${d.target.data.id}')`
            );
    };

    registerClickHandlers = (
        selection:
            | Selection<SVGGElement, HierarchyPointNode<TMCNode>, any, any>
            | Selection<SVGGElement, HierarchyPointLink<TMCNode>, any, any>
    ) => {
        const that = this;
        selection.on('click', function (event, d) {
            let pruner: ClickPruner = {};
            const targetNodeId = isLinkNode(d)
                ? d.target.data.id
                : (d as HierarchyPointNode<TMCNode>).data.id;

            if (event.ctrlKey) {
                pruner = {
                    key: 'setRootNode',
                    value: targetNodeId,
                };
            } else if (event.shiftKey) {
                pruner = {
                    key: 'setCollapsedNode',
                    value: targetNodeId,
                };
            }
            if (pruner.key) {
                const newHistory = that.ContextManager.pruneContext
                    .slice(-1)[0]
                    .clickPruneHistory.concat(pruner);

                that.ContextManager.setPruneContext({
                    clickPruneHistory: newHistory,
                });
            }
        });
    };

    render = () => {
        const that = this;

        const {
            branchSizeScale,
            distanceVisible,
            colorScale,
            colorScaleKey,
            nodeCountsVisible,
            nodeIdsVisible,
            pieScale,
            piesVisible,
            strokeVisible,
            visibleNodes,
        } = this.ContextManager.displayContext;

        const textSizeScale = scaleLinear([10, 40]).domain(
            extent(visibleNodes.leaves().map(d => d.value!)) as [number, number]
        );

        this.nodes = this.nodeContainer
            .selectAll<SVGGElement, HierarchyPointNode<TMCNode>>('g.node')
            .data(visibleNodes.descendants(), d => d.data.nodeId)
            .join(
                enter => {
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

        this.nodes.call(this.registerClickHandlers);

        this.links = this.linkContainer
            .selectAll<SVGGElement, HierarchyPointLink<TMCNode>>('g.link')
            .data(visibleNodes.links(), d => makeLinkId(d))
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
            .attr('stroke', strokeVisible ? 'black' : 'none');

        this.links.call(this.registerClickHandlers);

        /* append nodes */
        this.nodes
            .selectAll<SVGPathElement, HierarchyPointNode<TMCNode>>(
                'circle.node'
            )
            //need to wrap datum to prevent d3 from calling Array.from() on node and returning all descendants!
            .data((d: HierarchyPointNode<TMCNode>) => [d])
            .join('circle')
            .attr('class', 'node')
            .attr('stroke', strokeVisible ? 'black' : 'none')
            .attr('fill', d =>
                d.children ? getColor(colorScale, colorScaleKey, d) : null
            )
            .attr('r', d => (d.children ? branchSizeScale(d.value || 0) : 0));

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
            .style('visibility', nodeIdsVisible ? 'visible' : 'hidden');

        /* LEAF ADORNMENTS */

        /* item counts */
        this.nodes
            .selectAll('text.node-count')
            .data(d => [d])
            .join('text')
            .style('cursor', 'pointer')
            .style('font-size', d => textSizeScale(d.value!))
            .attr('class', 'node-count')
            .text(d => (d.children ? null : d.value!))
            .attr('text-anchor', 'middle')
            .style('visibility', nodeCountsVisible ? 'visible' : 'hidden');

        /* pies */

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
                        getPie(Object.entries(outer.data[colorScaleKey])).map(
                            counts => ({
                                counts,
                            })
                        ),
                        () => `${outer.data.nodeId}-${outer.children}`
                    )
                    .join('path')
                    .attr('stroke', 'none')
                    .transition()
                    .duration(that.transitionTime)
                    .attr('d', d => {
                        //there's a timing issue here that can lead to issues with tweening between scales
                        return !outer.children
                            ? arc()({
                                  innerRadius: 0,
                                  outerRadius: pieScale(outer.value!),
                                  ...d.counts,
                              })
                            : null;
                    })

                    .attr('fill', d => {
                        return colorScale(d.counts.data[1].scaleKey);
                    });
            })
            .style('visibility', piesVisible ? 'visible' : 'hidden')
            .on('click', (event, d) => {
                if (event.shiftKey) {
                    const collapsed =
                        that.ContextManager.activePruneStep.clickPruneHistory.find(
                            p =>
                                p.key === 'setCollapsedNode' &&
                                p.value === d.data.id
                        );
                    if (collapsed) {
                        const clickPruneHistory =
                            that.ContextManager.activePruneStep?.clickPruneHistory.filter(
                                h =>
                                    !(
                                        h.key === 'setCollapsedNode' &&
                                        h.value === d.data.id
                                    )
                            );
                        that.ContextManager.setPruneContext({
                            clickPruneHistory,
                        });
                    }

                    event.stopPropagation();
                }
            });

        /* Append distance arcs --> have to go on top of everything */
        this.container
            .selectAll<SVGGElement, HierarchyPointNode<TMCNode>>(
                'path.distance'
            )
            .data(visibleNodes.descendants(), d => d.data.nodeId)
            .join('path')
            .on('mouseover', (e: MouseEvent, d: HierarchyNode<TMCNode>) =>
                showToolTip(d.data, e)
            )
            .on('mouseout', () =>
                selectAll('.tooltip').style('visibility', 'hidden')
            )
            .attr('class', 'distance')
            .style('visibility', distanceVisible ? 'visible' : 'hidden')
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
    };
}

export default RadialTree;
