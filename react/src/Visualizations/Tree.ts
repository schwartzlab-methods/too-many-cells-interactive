import 'd3-transition'; // must be imported before selection
import { extent, sum } from 'd3-array';
import { dispatch } from 'd3-dispatch';
import { D3DragEvent, drag, DragBehavior } from 'd3-drag';
import { format } from 'd3-format';
import { HierarchyPointLink } from 'd3-hierarchy';
import { ScaleLinear, scaleLinear } from 'd3-scale';
import { BaseType, select, selectAll, Selection } from 'd3-selection';
import { arc, pie, PieArcDatum, pointRadial } from 'd3-shape';
import { zoom } from 'd3-zoom';
import { carToRadius, carToTheta, formatDigit, squared } from '../util';
import {
    isLinkNode,
    TMCHierarchyPointNode,
    TMCHiearchyLink,
    TMCHierarchyDataNode,
    AttributeMap,
    TMCNode,
} from '../types';
import { ClickPruner } from '../redux/pruneSlice';
import {
    ColorScaleVariant,
    Scales,
    ToggleableDisplayElements,
} from '../redux/displayConfigSlice';

const noop = () => null;

/* re-exporting for backend */
export const d3select = select;

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

/**
 *
 * @param data Array of nodes that have been split for each feature label, so there is one node per label/feature
 *              this is so we can pass each slice to the color function without angering typescript
 * @param key the field to be passed to the color scale
 */
const makePie = (data: TMCHierarchyPointNode[], key: ColorScaleVariant) =>
    pie<TMCHierarchyPointNode>().value(d => {
        const item = Object.values(d.data[key])[0];
        //if scalekey is numeric  use that, otherwise use quantity
        //we're using abs value here b/c the only time we (should) have a negative number is when it is a user
        //annotation or other singleton annotation (i.e., the pie only has one slice and is effectively a scaled dot)
        //if we have a pie with multiple slices represented by negative numbers, they'll need to be converted somehow
        //into categorical values
        return (
            (typeof item.scaleKey === 'number'
                ? Math.abs(item.scaleKey)
                : Math.abs(item.quantity)) || 1
        );
    })(data);

const getPie = (d: PieArcDatum<TMCHierarchyPointNode>, outerRadius: number) =>
    arc()({
        innerRadius: 0,
        outerRadius,
        ...d,
    }) || '';

const attachToolTip = () => {
    const tt = select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('z-index', 999)
        .style('position', 'absolute')
        .style('background-color', 'black')
        .style('font-size', '10px')
        .style('color', 'white')
        .style('border-radius', '5px')
        .style('visibility', 'hidden')
        .style('padding', '5px');

    const innerContainer = tt.append('div').attr('class', 'inner');

    innerContainer
        .append('div')
        .attr('class', 'heading')
        .style('display', 'block')
        .append('ul')
        .style('list-style-type', 'none')
        .style('margin', '0px')
        .style('padding', '5px')
        .style('border-bottom', 'solid white thin');

    const detailContainer = innerContainer
        .append('div')
        .attr('class', 'detail')
        .style('display', 'flex');

    detailContainer
        .append('div')
        .attr('class', 'label')
        .append('ul')
        .style('list-style-type', 'none')
        .style('margin', '0px')
        .style('padding', '5px');

    detailContainer
        .append('div')
        .attr('class', 'features')
        .append('ul')
        .style('list-style-type', 'none')
        .style('margin', '0px')
        .style('padding', '5px');
};

const getHiLoValues = (hilos: AttributeMap) => {
    const total = sum(Object.values(hilos).map(hl => hl.quantity));
    return Object.values(hilos)
        .sort((a, b) => (a.quantity < b.quantity ? 1 : -1))
        .map(v => ({
            ...v,
            total,
        }));
};

const showToolTip = (
    data: TMCHierarchyPointNode,
    activeFeatures: string[],
    colorScaleKey: ColorScaleVariant,
    e: MouseEvent
) => {
    const cellCount = sum(
        Object.values(data.data.labelCount).map(v => v.quantity)
    );

    const formatPercent = format('.1%');

    const container = select('.tooltip')
        .style('left', `${e.pageX + 15}px`)
        .style('top', `${e.pageY - 15}px`)
        .style('visibility', 'visible');

    const inner = container.select('.inner');

    const detail = container.select('.detail');

    const headingContainer = inner.select('div.heading ul');

    headingContainer
        .selectAll('li')
        .data([
            ['Node Id', data.data.originalNodeId],
            [
                'Distance',
                data.data.distance ? formatDigit(data.data.distance) : 'null',
            ],
            ['Observation Count', data.value!.toLocaleString()],
        ])
        .join('li')
        .attr('class', 'heading-value')
        .html(d => `<strong>${d[0]}:&nbsp;</strong> ${d[1]}`);

    const labelContainer = detail.select('div.label ul');

    labelContainer
        .selectAll('li.item')
        .data(
            Object.values(data.data.labelCount).sort((a, b) =>
                a.quantity < b.quantity ? 1 : -1
            ),
            Math.random
        )
        .join('li')
        .attr('class', 'item')
        .each(function (v) {
            const s = select(this).append('span');
            const strong = s.append('strong');
            strong.html(`${v.scaleKey}: `);
            const val = s.append('span');
            val.html(
                `${formatPercent(v.quantity / cellCount)} (${formatDigit(
                    v.quantity
                )})`
            );
        });

    const featuresContainer = detail.select('div.features ul');

    featuresContainer
        .selectAll('li.hi-lo-item')
        .data(
            colorScaleKey === 'featureHiLos'
                ? getHiLoValues(data.data.featureHiLos)
                : [],
            Math.random
        )
        .join('li')
        .attr('class', 'hi-lo-item')
        .each(function (d) {
            const s = select(this).append('span');
            const strong = s.append('strong');
            strong.html(`${d.scaleKey}: `);
            const val = s.append('span');
            val.html(
                `${formatPercent(d.quantity / d.total)} (${formatDigit(
                    d.quantity
                )})`
            );
        });

    featuresContainer
        .selectAll('li.feature-item')
        .data(
            colorScaleKey === 'featureAverage' && activeFeatures.length
                ? [data.data.featureAverage.average.quantity]
                : [],
            Math.random
        )
        .join('li')
        .attr('class', 'feature-item')
        .each(function (d) {
            const s = select(this).append('span');
            const strong = s.append('strong');
            strong.html(`Feature Average: `);
            const val = s.append('span');
            val.html(d.toLocaleString());
        });

    featuresContainer
        .selectAll('li.user-annotation')
        .data(
            colorScaleKey === 'userAnnotation'
                ? [Object.values(data.data.userAnnotation)[0].quantity]
                : [],
            Math.random
        )
        .join('li')
        .attr('class', 'user-annotation')
        .each(function (d) {
            const s = select(this).append('span');
            const strong = s.append('strong');
            strong.html(`User Annotation: `);
            const val = s.append('span');
            val.html(d === null ? 'null' : d.toLocaleString());
        });
};

const makeLinkId = (link: TMCHiearchyLink) =>
    `${link.source.data.originalNodeId}-${
        link.target.data.originalNodeId
    }-${!!link.source.children}`;

const deltaBehavior = dispatch('nodeDelta', 'linkDelta');

interface TreeScales {
    branchSizeScale: ScaleLinear<number, number>;
    colorScaleWrapper: (node: TMCHierarchyPointNode) => string;
    pieScale: ScaleLinear<number, number>;
}

type ColorScaleKey = Scales['colorScale']['variant'];

interface ClickPruneCallbacks {
    addClickPrune: (pruner: ClickPruner) => void;
    removeClickPrune: (pruner: ClickPruner) => void;
}

interface DisplayContext {
    activeFeatures: string[];
    clickPruneHistory: ClickPruner[];
    colorScaleKey: ColorScaleKey;
    scales: TreeScales;
    toggleableFeatures: ToggleableDisplayElements;
    visibleNodes: TMCHierarchyPointNode;
    width: number;
}

export interface TreeContext {
    displayContext: DisplayContext;
    clickPruneCallbacks?: ClickPruneCallbacks;
}
class RadialTree {
    branchDragBehavior: DragBehavior<SVGPolygonElement, any, any> | typeof noop;
    container: Selection<SVGGElement, unknown, HTMLElement, any>;
    context: TreeContext;
    distanceScale: ScaleLinear<number, number>;
    gradientContainer: Selection<SVGDefsElement, unknown, HTMLElement, unknown>;
    linkContainer: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    links?: Selection<SVGGElement, TMCHiearchyLink, any, any>;
    nodeDragBehavior:
        | DragBehavior<SVGGElement, TMCHierarchyPointNode, unknown>
        | typeof noop;
    nodes?: Selection<SVGGElement, TMCHierarchyPointNode, any, any>;
    nodeContainer: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    svg: Selection<SVGSVGElement, unknown, HTMLElement, any>;
    serverSideMode = false;
    transitionTime = 250;
    constructor(
        context: TreeContext,
        selection: Selection<any, unknown, any, unknown>,
        serverSideMode = false
    ) {
        if (
            !serverSideMode &&
            (!context.clickPruneCallbacks?.addClickPrune ||
                !context.clickPruneCallbacks?.addClickPrune)
        ) {
            throw 'Prune callbacks missing!';
        }

        this.serverSideMode = serverSideMode;

        const that = this;

        this.context = context;

        this.svg = selection
            .append('svg')
            .attr('viewBox', [
                -this.context.displayContext.width / 2,
                -this.context.displayContext.width / 2,
                this.context.displayContext.width,
                this.context.displayContext.width,
            ]);

        this.container = this.svg
            .append('g')
            .attr('class', 'container')
            .attr('stroke-width', '1px');

        this.distanceScale = scaleLinear([0, 1]).domain(
            extent(
                this.context.displayContext.visibleNodes
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

        this.gradientContainer = this.container.append('defs');

        if (!this.serverSideMode) {
            attachToolTip();
            const zoomBehavior = zoom<SVGSVGElement, unknown>().on(
                'zoom',
                e => {
                    this.container.attr('transform', e.transform.toString());
                }
            );
            zoomBehavior(this.svg);
        }

        this.branchDragBehavior = this.serverSideMode
            ? noop
            : drag<SVGPolygonElement, any>()
                  .on(
                      'start',
                      function (
                          event: D3DragEvent<SVGGElement, TMCHiearchyLink, any>,
                          datum: TMCHiearchyLink
                      ) {
                          const targetNode = that.nodeContainer
                              .selectAll<SVGGElement, TMCHierarchyPointNode>(
                                  'g'
                              )
                              .filter(g => g.data.id === datum.target.data.id);

                          /* Get ids of all descendants of the target node */
                          const descIds = targetNode
                              .datum()
                              .descendants()
                              .map(d => d.data.originalNodeId);

                          const subtreeNodes = that.nodeContainer
                              .selectAll<SVGGElement, TMCHierarchyPointNode>(
                                  'g.node'
                              )
                              .filter(d =>
                                  descIds.includes(d.data.originalNodeId)
                              );

                          const subtreeLinks = that.linkContainer
                              .selectAll<SVGGElement, TMCHiearchyLink>(
                                  'polygon'
                              )
                              .filter(
                                  d =>
                                      descIds.includes(
                                          d.target.data.originalNodeId
                                      ) ||
                                      descIds.includes(
                                          d.source.data.originalNodeId
                                      )
                              );

                          deltaBehavior.on(
                              'linkDelta',
                              function (dx: number, dy: number) {
                                  subtreeNodes.attr('transform', function (d) {
                                      const { e: xt, f: yt } = select<any, any>(
                                          this
                                      )
                                          .node()
                                          .transform.baseVal.consolidate().matrix;

                                      const cart = pointRadial(d.x, d.y);

                                      const newX = cart[0] + dx;
                                      const newY = cart[1] + dy;

                                      // update the layout values while we're here (d3 gives in polar coordinates) to keep updates insync
                                      d.x = carToTheta(newX, newY);
                                      d.y = carToRadius(newX, newY);

                                      /* shift targetnode */
                                      return `translate(${
                                          xt + dx
                                      }, ${yt + dy})`;
                                  });

                                  /* redraw trapezoid link with updated coords*/
                                  subtreeLinks.attr(
                                      'points',
                                      (d: TMCHiearchyLink) =>
                                          drawScaledTrapezoid(
                                              pointRadial(
                                                  d.source.x,
                                                  d.source.y
                                              ),
                                              pointRadial(
                                                  d.target.x,
                                                  d.target.y
                                              ),
                                              that.context.displayContext.scales.branchSizeScale(
                                                  d.source.value!
                                              ),
                                              that.context.displayContext.scales.branchSizeScale(
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
                              TMCHierarchyPointNode,
                              any
                          >
                      ) => {
                          const { dx, dy } = event;
                          deltaBehavior.apply('linkDelta', undefined, [dx, dy]);
                      }
                  )
                  .on('end', () => deltaBehavior.on('linkDelta', null));

        this.nodeDragBehavior = serverSideMode
            ? noop
            : drag<SVGGElement, any>()
                  .on('start', (_, datum: TMCHierarchyPointNode) => {
                      const parentLink = that.linkContainer
                          .selectAll<SVGPolygonElement, TMCHiearchyLink>(
                              'polygon'
                          )
                          .filter(g => g.target.data.id === datum.data.id);

                      deltaBehavior.on('nodeDelta', (x: number, y: number) =>
                          parentLink.attr('points', d =>
                              drawScaledTrapezoid(
                                  pointRadial(d.source.x, d.source.y),
                                  [x, y],
                                  that.context.displayContext.scales.branchSizeScale(
                                      d.source.value!
                                  ),
                                  that.context.displayContext.scales.branchSizeScale(
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
                              TMCHierarchyPointNode,
                              any
                          >,
                          datum: TMCHierarchyPointNode
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

    renderLinks = (
        selection: Selection<SVGGElement, TMCHiearchyLink, any, unknown>
    ) => {
        const { branchSizeScale, colorScaleWrapper } =
            this.context.displayContext.scales;

        const gradients = this.gradientContainer
            .selectAll<BaseType, TMCHiearchyLink>('linearGradient')
            .data(
                this.context.displayContext.visibleNodes.links(),
                (d: TMCHiearchyLink) => makeLinkId(d)
            )
            .join('linearGradient')
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', d => pointRadial(d.source.x, d.source.y)[0])
            .attr('y1', d => pointRadial(d.source.x, d.source.y)[1])
            .attr('x2', d => pointRadial(d.target.x, d.target.y)[0])
            .attr('y2', d => pointRadial(d.target.x, d.target.y)[1])
            .attr(
                'id',
                d =>
                    `n-${d.source.data.originalNodeId}-${d.target.data.originalNodeId}`
            );

        gradients
            .selectAll('stop.start')
            .data<HierarchyPointLink<TMCNode>>(
                d => [d],
                d => makeLinkId(d as HierarchyPointLink<TMCNode>)
            )
            .join('stop')
            .attr('class', 'start')
            .attr('offset', '40%')
            .attr('stop-color', d => colorScaleWrapper(d.source));

        gradients
            .selectAll('stop.end')
            .data<HierarchyPointLink<TMCNode>>(
                d => [d],
                d => makeLinkId(d as HierarchyPointLink<TMCNode>)
            )
            .join('stop')
            .attr('class', 'end')
            .attr('offset', '85%')
            .attr('stop-color', d => colorScaleWrapper(d.target));

        return selection
            .selectAll<SVGPolygonElement, TMCHiearchyLink>('polygon.link')
            .data(
                d => [d],
                d => makeLinkId(d)
            )
            .join(
                enter => {
                    return enter
                        .append('polygon')
                        .attr('class', 'link')
                        .call(this.branchDragBehavior)
                        .attr('points', d => {
                            return drawScaledTrapezoid(
                                pointRadial(d.source.x, d.source.y),
                                pointRadial(d.target.x, d.target.y),
                                branchSizeScale(d.source.value!),
                                branchSizeScale(d.target.value!)
                            ).toString();
                        })
                        .attr(
                            'stroke',
                            this.context.displayContext.toggleableFeatures
                                .strokeVisible
                                ? 'black'
                                : 'none'
                        )
                        .attr(
                            'fill',
                            d =>
                                `url('#n-${d.source.data.originalNodeId}-${d.target.data.originalNodeId}')`
                        );
                },

                update =>
                    update
                        .attr(
                            'stroke',
                            this.context.displayContext.toggleableFeatures
                                .strokeVisible
                                ? 'black'
                                : 'none'
                        )
                        .attr(
                            'fill',
                            d =>
                                `url('#n-${d.source.data.originalNodeId}-${d.target.data.originalNodeId}')`
                        )
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
            );
    };

    registerClickHandlers = (
        selection:
            | Selection<SVGGElement, TMCHierarchyPointNode, any, any>
            | Selection<SVGGElement, TMCHiearchyLink, any, any>
    ) => {
        const that = this;
        selection.on('click', function (event, d) {
            let pruner: ClickPruner = {};
            const targetNodeId = isLinkNode(d)
                ? d.target.data.id
                : (d as TMCHierarchyPointNode).data.id;

            if (event.ctrlKey) {
                pruner = {
                    name: 'setRootNode',
                    value: { plainValue: targetNodeId },
                };
            } else if (event.shiftKey) {
                pruner = {
                    name: 'setCollapsedNode',
                    value: { plainValue: targetNodeId },
                };
            }
            if (pruner.name) {
                that.context.clickPruneCallbacks!.addClickPrune(pruner);
            }
        });
    };

    render = () => {
        const that = this;

        const { activeFeatures, colorScaleKey, scales, visibleNodes } =
            this.context.displayContext;

        const {
            distanceVisible,
            nodeCountsVisible,
            originalNodeIdsVisible,
            prunedNodeIdsVisible,
            piesVisible,
            strokeVisible,
        } = this.context.displayContext.toggleableFeatures;

        const { branchSizeScale, colorScaleWrapper, pieScale } = scales;

        this.nodes = this.nodeContainer
            .selectAll<SVGGElement, TMCHierarchyPointNode>('g.node')
            .data(visibleNodes.descendants(), d => d.data.originalNodeId)
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
                            .transition()
                            //.delay(this.transitionTime * 2)
                            .duration(this.transitionTime)
                            .attr('opacity', 1)
                            .each(function (d) {
                                if (!d.children) {
                                    select<SVGGElement, TMCHierarchyPointNode>(
                                        this
                                    ).call(that.nodeDragBehavior);
                                } else {
                                    select(this).on('mousedown.drag', null);
                                }
                            })
                    );
                },
                update => {
                    return update
                        .on(
                            'mouseover',
                            (e: MouseEvent, d: TMCHierarchyPointNode) =>
                                showToolTip(d, activeFeatures, colorScaleKey, e)
                        )
                        .on('mouseout', () =>
                            selectAll('.tooltip').style('visibility', 'hidden')
                        )
                        .transition()
                        .delay(this.transitionTime)
                        .duration(this.transitionTime)
                        .attr(
                            'transform',
                            d => `translate(${pointRadial(d.x, d.y)})`
                        )
                        .each(function (d) {
                            if (!d.children) {
                                select<SVGGElement, TMCHierarchyPointNode>(
                                    this
                                ).call(that.nodeDragBehavior);
                            } else {
                                select(this).on('mousedown.drag', null);
                            }
                        });
                },
                exit => exit.remove()
            );

        this.nodes.call(this.registerClickHandlers);

        this.links = this.linkContainer
            .selectAll<SVGGElement, TMCHiearchyLink>('g.link')
            .data(visibleNodes.links(), d => makeLinkId(d))
            .join('g')
            .attr('class', 'link');

        this.links
            .call(this.renderLinks)
            .selectAll<SVGPolygonElement, TMCHiearchyLink>('polygon')
            .on('mouseover', (e: MouseEvent, d: TMCHiearchyLink) =>
                showToolTip(d.target, activeFeatures, colorScaleKey, e)
            )
            .on('mouseout', () =>
                selectAll('.tooltip').style('visibility', 'hidden')
            )
            .attr('stroke', strokeVisible ? 'black' : 'none');

        this.links.call(this.registerClickHandlers);

        /* append nodes */
        this.nodes
            .selectAll<SVGPathElement, TMCHierarchyPointNode>('circle.node')
            //need to wrap datum to prevent d3 from calling Array.from() on node and returning all descendants!
            .data((d: TMCHierarchyPointNode) => [d])
            .join('circle')
            .attr('class', 'node')
            .attr('stroke', strokeVisible ? 'black' : 'none')
            .attr('fill', d => (d.children ? colorScaleWrapper(d) : null))
            .attr('r', d => (d.children ? branchSizeScale(d.value || 0) : 0));

        /* LEAF ADORNMENTS */

        /* pies */

        this.nodes
            .selectAll('g.pie')
            .data(
                d => (piesVisible ? [d] : []),
                d =>
                    `${(d as TMCHierarchyDataNode).data.id}-${
                        (d as TMCHierarchyDataNode).children ? 'a' : 'b'
                    }`
            )
            .join('g')
            .attr('class', 'pie')
            .filter(d => !d.children)
            .style('cursor', 'pointer')
            .each(function (outer) {
                select(this)
                    .selectAll('path')
                    .attr('class', 'pie')
                    .data(
                        makePie(
                            Object.entries(outer.data[colorScaleKey]).map(
                                ([k, v]) => ({
                                    ...outer,
                                    data: {
                                        ...outer.data,
                                        [colorScaleKey]: { [k]: v },
                                    },
                                })
                            ),
                            colorScaleKey
                        ),
                        d =>
                            `${
                                Object.entries(
                                    (d as PieArcDatum<TMCHierarchyPointNode>)
                                        .data.data[colorScaleKey]
                                )[0][1].scaleKey
                            }-${outer.data.originalNodeId}-${outer.children}`
                    )
                    .join('path')
                    .attr('stroke', 'none')
                    .attr('d', d => getPie(d, pieScale(outer.value!)))
                    .attr('fill', d => colorScaleWrapper(d.data));
            })
            .on('click', (event, d) => {
                if (event.shiftKey) {
                    const collapsed =
                        that.context.displayContext.clickPruneHistory.find(
                            p =>
                                p.name === 'setCollapsedNode' &&
                                p.value?.plainValue === d.data.id
                        );
                    if (collapsed) {
                        that.context.clickPruneCallbacks!.removeClickPrune(
                            collapsed
                        );
                    }

                    event.stopPropagation();
                }
            });

        /* Append distance arcs --> have to go on top of everything */
        this.nodes
            .selectAll<SVGGElement, TMCHierarchyPointNode>('path.distance')
            .data(
                d => (distanceVisible ? [d] : []),
                d => d.data.originalNodeId
            )
            .join('path')
            .on('mouseover', (e: MouseEvent, d: TMCHierarchyPointNode) =>
                showToolTip(d, activeFeatures, colorScaleKey, e)
            )
            .on('mouseout', () =>
                selectAll('.tooltip').style('visibility', 'hidden')
            )
            .attr('class', 'distance')
            .attr('d', d => (d.children ? arcPath : null))
            .transition()
            .delay(this.transitionTime)
            .duration(this.transitionTime)
            .attr('stroke', 'black')
            .attr('opacity', d => this.distanceScale(d.data.distance || 0));

        /* item counts */

        this.nodes
            .selectAll('text.node-count')
            .data(d => (nodeCountsVisible ? [d] : []))
            .join('text')
            .style('cursor', 'pointer')
            .attr('class', 'node-count')
            .text(d => d.value!.toLocaleString())
            .attr('text-anchor', 'middle');

        /* node ids */
        this.nodes
            .selectAll<SVGTextElement, TMCHierarchyPointNode>(
                'text.original-node-id'
            )
            .data(d => (originalNodeIdsVisible ? [d] : []))
            .join('text')
            .style('cursor', 'pointer')
            .attr('class', 'original-node-id')
            .text(d => {
                debugger;
                return d.data.originalNodeId;
            })
            .attr('text-anchor', 'middle');

        this.nodes
            .selectAll<SVGTextElement, TMCHierarchyPointNode>(
                'text.pruned-node-id'
            )
            .data(d => (prunedNodeIdsVisible ? [d] : []))
            .join('text')
            .style('cursor', 'pointer')
            .attr('class', 'pruned-node-id')
            .text(d => d.data.prunedNodeId)
            .attr('text-anchor', 'middle');
    };
}

export default RadialTree;
