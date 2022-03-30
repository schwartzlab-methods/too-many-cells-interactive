import 'd3-transition'; // must be imported before selection
import { BaseType, select, selectAll, Selection } from 'd3-selection';
import {
    HierarchyNode,
    HierarchyPointLink,
    HierarchyPointNode,
    stratify,
    tree,
} from 'd3-hierarchy';
import { arc, pie, pointRadial } from 'd3-shape';
import { scaleLinear, ScaleOrdinal, scaleOrdinal } from 'd3-scale';
import data, { labelMap, TMCNodeBase } from './prepareData';
import { extent, quantile, sum } from 'd3-array';
import { zoom } from 'd3-zoom';
import { schemeAccent } from 'd3-scale-chromatic';
import { rgb } from 'd3-color';
import { format } from 'd3-format';
import { D3DragEvent, drag, DragBehavior } from 'd3-drag';
import {
    carToRadius,
    carToTheta,
    getMAD,
    hierarchize,
    sortChildren,
    squared,
} from './Util';
import { dispatch } from 'd3-dispatch';

// for debugging
(window as any).select = select;

type Point = [number, number];

export interface TMCNode extends TMCNodeBase {
    labelCount: Record<string, number>;
    nodeId: number;
}

const initialData = hierarchize(data) as HierarchyNode<TMCNode>;

const addLabelsAndIds = (node: HierarchyNode<TMCNode>) => {
    /* aggregate tissue label counts */
    return node
        .copy()
        .eachAfter(n => {
            n.data.labelCount = n
                .descendants()
                .reduce<Record<string, number>>((acc, curr) => {
                    if (curr.data.items) {
                        curr.data.items.forEach(item => {
                            acc[labelMap[item._barcode.unCell]] =
                                (acc[labelMap[item._barcode.unCell]] || 0) + 1;
                        });
                    }
                    return acc;
                }, {});
        })
        .eachBefore((n, i) => {
            n.data.nodeId = i;
        });
};

const nodes = addLabelsAndIds(initialData);

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

const branchSizeScale = scaleLinear([0.1, 22]).domain(
    extent(nodes.descendants().map(d => d.value!)) as [number, number]
);

const distanceScale = scaleLinear([0, 1]).domain(
    extent(nodes.descendants().map(d => +(d.data.distance || 0))) as [
        number,
        number
    ]
);

const labels = Array.from(new Set(Object.values(labelMap))).filter(Boolean);

const labelScaleD3 = scaleOrdinal(schemeAccent).domain(labels);

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

const buildTree = (nodes: HierarchyNode<TMCNode>) =>
    tree<TMCNode>()
        .size([2 * Math.PI, 450])
        .separation((a, b) => (a.parent == b.parent ? 3 : 2) / a.depth)(nodes);

const makeLinkId = (link: HierarchyPointLink<TMCNode>) =>
    `${link.source.data.nodeId}-${link.target.data.nodeId}-${!!link.source
        .children}`;

const deltaBehavior = dispatch('nodeDelta', 'linkDelta');

class RadialTree {
    branchDragBehavior: DragBehavior<SVGPolygonElement, any, any>;
    container: Selection<SVGGElement, unknown, HTMLElement, any>;
    distanceVisible = false;
    //labelScale = scaleOrdinal(['#66C2A5', '#EF966E']).domain(labels);
    labelScale = labelScaleD3;
    legendSelector: string;
    linkContainer: Selection<SVGGElement, unknown, HTMLElement, unknown>;
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
    positionedTree: HierarchyPointNode<TMCNode>;
    selector: string;
    strokeVisible = false;
    svg: Selection<SVGSVGElement, unknown, HTMLElement, any>;
    transitionTime = 250;
    valueMap: Record<string, number>;

    constructor(selector: string, legendSelector: string) {
        this.selector = selector;
        this.legendSelector = legendSelector;

        this.svg = select(this.selector)
            .append('svg')
            .attr('viewBox', [-500, -500, 1000, 1000]);

        this.container = this.svg
            .append('g')
            .attr('class', 'container')
            .attr('stroke-width', '1px');

        this.rootPositionedTree = buildTree(nodes);
        this.positionedTree = buildTree(nodes);

        this.nodeContainer = this.container
            .append('g')
            .attr('class', 'node-container')
            .attr('stroke-opacity', 0.8);

        this.linkContainer = this.container
            .append('g')
            .attr('class', 'link-container')
            .attr('fill', 'none');

        const zoomBehavior = zoom<SVGSVGElement, unknown>().on('zoom', e =>
            this.container.attr('transform', e.transform.toString())
        );

        this.valueMap = {};

        const descendants = this.rootPositionedTree.descendants();

        for (let i = 0; i < this.rootPositionedTree.descendants().length; i++) {
            this.valueMap[descendants[i].data.id] = descendants[i].value!;
        }

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
                                        branchSizeScale(d.source.value!),
                                        branchSizeScale(d.target.value!)
                                    ).toString()
                            );
                        }
                    );
                }
            )
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
                    deltaBehavior.apply('linkDelta', undefined, [dx, dy]);
                }
            )
            .on('end', () => deltaBehavior.on('linkDelta', null));

        this.nodeDragBehavior = drag<SVGGElement, any>()
            .on(
                'start',
                function (
                    event: D3DragEvent<
                        SVGGElement,
                        HierarchyPointNode<TMCNode>,
                        any
                    >,
                    datum: HierarchyPointNode<TMCNode>
                ) {
                    const parentLink = that.linkContainer
                        .selectAll<
                            SVGPolygonElement,
                            HierarchyPointLink<TMCNode>
                        >('polygon')
                        .filter(g => g.target.data.id === datum.data.id);

                    deltaBehavior.on(
                        'nodeDelta',
                        function (x: number, y: number) {
                            parentLink.attr('points', d =>
                                drawScaledTrapezoid(
                                    pointRadial(d.source.x, d.source.y),
                                    [x, y],
                                    branchSizeScale(d.source.value!),
                                    branchSizeScale(d.target.value!)
                                ).toString()
                            );
                        }
                    );
                }
            )
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
        this.svg
            .selectAll('polygon')
            .attr('stroke', () => (!!this.strokeVisible ? 'none' : 'black'));

        this.svg
            .selectAll('circle.node')
            .attr('stroke', () => (!!this.strokeVisible ? 'none' : 'black'));

        this.svg
            .selectAll('path.pie')
            .attr('stroke', () => (!!this.strokeVisible ? 'none' : 'black'));

        this.strokeVisible = !this.strokeVisible;
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

    /**
     * setMinCount Prune the tree by setting a minimum value for each node and rerender the tree
     * Visits nodes in pre-order traversal, meaning that we start with the root and if a node has a child that is less
     * that the target value, ALL children get snipped, so each node's value is the value of its least child
     * @param minSize Minimum value for node (and therefore all children) in order to remain in the graphic
     */
    setMinCount = (minSize: number) => {
        const newTree = this.rootPositionedTree.copy().eachBefore(d => {
            if (d.value! < minSize) {
                if (d.data.parent && d.parent) {
                    d.data.parent.children = null;
                    d.parent.children = undefined;
                }
            }
        });
        this.positionedTree = buildTree(newTree);
        this.render();
    };

    /**
     * https://github.com/GregorySchwartz/birch-beer/blob/master/src/BirchBeer/Stopping.hs#L260
     * @returns 1 MAD for the count of items per node in the tree
     */
    getCountMad = () =>
        getMAD(this.rootPositionedTree.descendants().map(v => v.value!));

    /**
     * @returns median value of items in tree
     */
    getCountMedian = () =>
        quantile(
            this.rootPositionedTree.descendants().map(v => v.value!),
            0.5
        );

    /**
     * @returns 1 MAD for the count of items per node in the tree
     */
    getDistanceMad = () =>
        getMAD(
            this.rootPositionedTree
                .descendants()
                .map(v => v.data.distance!)
                .filter(Boolean)
        );

    /**
     * @returns median value of distances in the tree
     */
    getDistanceMedian = () =>
        quantile(
            this.rootPositionedTree
                .descendants()
                .map(v => v.data.distance!)
                .filter(Boolean),
            0.5
        );

    /**
     * Cut a dendrogram based off of the distance, keeping up to and including the
     * children of the stopping vertex. Stop is distance is less than the input
     * distance.
     *
     * Ought to proceed from the root: https://github.com/GregorySchwartz/too-many-cells/blob/master/src/TooManyCells/Program/Options.hs#L43
     *
     * problem here is that we're not stopping once we get up the tree
     * we need to start with each child, then go up and stop
     * @param distance minimum distance
     * https://github.com/GregorySchwartz/birch-beer/blob/master/src/BirchBeer/Stopping.hs#L137
     */
    setMinDistance = (distance: number) => {
        const newTree = this.rootPositionedTree.copy().eachBefore(d => {
            if (!d.data.distance || d.data.distance < distance) {
                //keep the node, even though it's under the threshold, but eliminate the children
                d.children = undefined;
            }
        });

        this.positionedTree = buildTree(newTree);
        this.render();
    };

    /* 
        Searches from the leaves (has a bug -- see hinge nodes)
        Should correspond to https://github.com/GregorySchwartz/too-many-cells/blob/master/src/TooManyCells/Program/Options.hs#L44

        this is kind of clever and maybe good for using later, but there's an obvious problem: 
            it you trim at the first one that doesn't match, you'll immediate stop on large numbers
                b/c every leaf will get cut right away and you'll stop (if it's like 1.5 or something)
            whereas if we just filter out all the nodes that have less than that distance, we can easily reach the
                the root if there is a path wherein the distance is above until the very end
            try running his version and see.        
    
    */
    setMinDistance2 = (distance: number) => {
        const recurse = (node: HierarchyPointNode<TMCNode>) => {
            if (
                node.parent &&
                (!node.parent?.data.distance ||
                    node.parent.data.distance < distance)
            ) {
                node.parent.children = undefined;
                return node.parent;
            } else if (node.parent) {
                recurse(node.parent!);
            } else if (!node.parent) {
                return node;
            }
        };

        const newNodes = this.rootPositionedTree
            .copy()
            .leaves()
            .filter(Boolean)
            .map(recurse)
            .flatMap(l => l?.ancestors())
            .filter(
                (v, i, arr) =>
                    arr.findIndex(inn => inn?.data.id === v?.data.id) === i
            )
            .filter(Boolean)
            .map(d => d!.data);

        if (newNodes.length) {
            const newTree = stratify<TMCNode>().parentId(d => d.parent?.id)(
                newNodes
            );

            const sorted = sortChildren(newTree);

            this.positionedTree = buildTree(sorted).each(
                //it's read only but we're going to set it anyway!
                //@ts-ignore
                n => (n.value = this.valueMap[n.id])
            );

            this.render();
        }
    };

    /* todo: why is add label scale not triggering rerender? why do nodes rerender every time? */
    renderLinks = (
        selection: Selection<SVGGElement, unknown, any, unknown>
    ) => {
        const gradients = this.container
            .selectAll<BaseType, HierarchyPointLink<TMCNode>>('linearGradient')
            .data(
                this.positionedTree.links(),
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
                'polygon'
            )
            .data(
                this.positionedTree.links(),
                (d: HierarchyPointLink<TMCNode>) => makeLinkId(d)
            )
            .join(
                enter => {
                    return enter
                        .append('polygon')
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
            .attr('stroke', 'none')
            .attr(
                'fill',
                d => `url('#${d.source.data.id}-${d.target.data.id}')`
            );
    };

    render = () => {
        const pieScale = scaleLinear([5, 20]).domain(
            extent(this.positionedTree.leaves().map(d => d.value!)) as [
                number,
                number
            ]
        );

        const textSizeScale = scaleLinear([10, 40]).domain(
            extent(this.positionedTree.leaves().map(d => d.value!)) as [
                number,
                number
            ]
        );

        this.nodes = this.nodeContainer
            .selectAll<SVGGElement, HierarchyPointNode<TMCNode>>('g.node')
            .data(
                this.positionedTree.descendants(),
                (d: HierarchyPointNode<TMCNode>) => d.data.nodeId
            )
            .join(
                enter => {
                    const that = this;
                    return enter
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
                            selectAll('.tooltip').style('visibility', 'hidden')
                        )
                        .transition()
                        .delay(this.transitionTime * 2)
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
                        });
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

        /* append nodes */
        this.nodes
            .selectAll<SVGPathElement, HierarchyPointNode<TMCNode>>(
                'circle.node'
            )
            //need to wrap datum to prevent d3 from calling Array.from() on node and returning all descendants!
            .data((d: HierarchyPointNode<TMCNode>) => [d])
            .join('circle')
            .attr('class', 'node')
            .attr('stroke', 'none')
            .attr('fill', d =>
                d.children
                    ? getBlendedColor(d.data.labelCount, this.labelScale)
                    : null
            )
            .attr('r', d => (d.children ? branchSizeScale(d.value || 0) : 0));

        this.linkContainer
            .attr('class', 'links')
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
            .attr('stroke', 'none');

        /* Append distance arcs  */
        this.nodes
            .selectAll<SVGPathElement, HierarchyPointNode<TMCNode>>(
                'path.distance'
            )
            .data(d => [d])
            .join('path')
            .attr('class', 'distance')
            .attr('d', d => (d.children ? arcPath : null))
            .transition()
            .delay(this.transitionTime)
            .duration(this.transitionTime)
            .style('visibility', this.distanceVisible ? 'visible' : 'hidden')
            .attr('stroke', 'black')
            .attr('opacity', d => distanceScale(d.data.distance || 0));

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

        this.drawLegend();
    };
}

export default RadialTree;
