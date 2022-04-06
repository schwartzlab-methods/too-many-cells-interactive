import { median, min, range, ticks } from 'd3-array';
import { HierarchyNode } from 'd3-hierarchy';
import { scaleLinear, ScaleLinear } from 'd3-scale';
import { select, Selection } from 'd3-selection';
import { sliderBottom } from 'd3-simple-slider';
import './style.scss';
import data, { TMCNodeBase, labelMap } from './prepareData';
import { getMAD, hierarchize, pruneTreeByMinValue } from './Util';
import TreeViz from './Tree';
import AreaChart from './AreaChart';

export interface TMCNode extends TMCNodeBase {
    labelCount: Record<string, number>;
    nodeId: number;
}

const initialData = hierarchize(data) as HierarchyNode<TMCNode>;

/**
 * Find the minimum size-cutoff value needed to display at least one generation of the tree
 * This ends up being the smallest child of the root
 */
const getMaxCutoffNodeSize = (tree: HierarchyNode<TMCNode>) => {
    if (tree.children) {
        return min(tree.children.map(d => d.value || 0));
    } else return 0;
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` <= n in tree
 */
const getSizeGroups = (tree: HierarchyNode<TMCNode>, binCount = 50) => {
    const maxSize = getMaxCutoffNodeSize(tree)!;

    const bounds = ticks(0, maxSize, binCount);

    return bounds.reduce(
        (acc, curr) => ({
            ...acc,
            [curr]: pruneTreeByMinValue(tree, curr).descendants().length,
        }),
        {}
    );
};

/**
 * @returns object keyed by integer `n` whose value is count of nodes with `value` >= median + (n * MAD) in tree
 */
const getMadGroups = (tree: HierarchyNode<TMCNode>) => {
    const maxSize = getMaxCutoffNodeSize(tree)!;

    const values = tree
        .descendants()
        .map(d => d.value!)
        .sort((a, b) => (a < b ? -1 : 1));

    const mad = getMAD(values)!;
    const med = median(values)!;

    const maxMads = Math.ceil((maxSize - med) / mad);

    const bounds = range(0, maxMads).map(m => ({
        size: med + m * mad,
        mads: m,
    }));

    return bounds.reduce(
        (acc, curr) => ({
            ...acc,
            [curr.mads]: pruneTreeByMinValue(tree, curr.size).descendants()
                .length,
        }),
        {}
    );
};

const madGroups = getMadGroups(initialData);

const sizeGroups = getSizeGroups(initialData, 12);

select('.color-controls')
    .append('div')
    .attr('class', 'raw-count')
    .style('width', '350px');

const CountHist = new AreaChart(
    sizeGroups,
    val => {
        requestAnimationFrame(Tree.setMinCount.bind(null, val));
    },
    '.raw-count',
    'Node counts by bin upper threshold'
);

CountHist.render();

select('.color-controls')
    .append('div')
    .attr('class', 'mad-count')
    .style('width', '350');

const MadHist = new AreaChart(
    madGroups,
    val => {
        requestAnimationFrame(Tree.setMinCount.bind(null, val * mad + med));
    },
    '.mad-count',
    'Node counts by MAD distance'
);

MadHist.render();

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

const tree = addLabelsAndIds(initialData);

const styleControls = select('body .controls-container .style-controls');
const pruneControls = select('body .controls-container .prune-controls');

const legend = styleControls.append('div').attr('class', 'legend');

const Tree = new TreeViz('.viz-container', '.legend', tree);

const makeSlider = (
    selection: Selection<SVGGElement, any, any, any>,
    name: string,
    scale: ScaleLinear<number, number>,
    onChange: (val: number) => void
) => {
    //typing here is not great
    //@ts-ignore
    const slider = sliderBottom(scale)
        //@ts-ignore
        .default(0)
        .ticks(3)
        .step(scale.domain()[1] > 1 ? 1 : 0.0002)
        .on('onchange', (val: number) => onChange(val));

    selection.attr('class', name);

    slider(selection);
};

const renderStyleControls = () => {
    const makeToggle = (
        selection: Selection<HTMLButtonElement, unknown, any, unknown>,
        name: string,
        fn: () => void,
        defaultVal?: boolean
    ) =>
        selection
            .attr('data', !!defaultVal ? 'hide' : 'show')
            .text(!!defaultVal ? `Hide ${name}` : `Show ${name}`)
            .on('click', function () {
                fn();
                const hidden = select(this).attr('data') === 'hide';
                select(this).text(hidden ? `Show ${name}` : `Hide ${name}`);
                select(this).attr('data', hidden ? 'show' : 'hide');
            });

    styleControls
        .append('button')
        .call(makeToggle, 'Stroke', Tree.toggleStroke);

    styleControls
        .append('button')
        .call(makeToggle, 'Node Counts', Tree.toggleNodeCounts);

    styleControls
        .append('button')
        .call(makeToggle, 'Node IDs', Tree.toggleNodeIds);

    styleControls
        .append('button')
        .call(makeToggle, 'Distance', Tree.toggleDistance);

    styleControls
        .append('button')
        .call(makeToggle, 'Pies', Tree.togglePies, Tree.piesVisible);
};

interface PruneCallbacks {
    getDomain: () => [number, number];
    getMad: () => number;
    getMedian: () => number;
    prune: (min: number) => void;
}

const makePruner = (
    selection: Selection<HTMLDivElement, unknown, any, unknown>,
    name: string,
    fn: PruneCallbacks
) => {
    selection.attr('class', 'prune-container');

    const getUnitType = () =>
        selection.select<HTMLInputElement>('input[type=radio]:checked').node()
            ?.value;

    const getInputvalue = () =>
        selection.select<HTMLInputElement>('input[type=text]').node()?.value;

    const header = selection
        .append('div')
        .attr('class', 'header')
        .attr('data', 'collapsed')
        .on('click', function () {
            const shouldExpand = select(this).attr('data') === 'collapsed';

            select(this)
                .attr('data', shouldExpand ? 'expanded' : 'collapsed')
                .select('.toggler')
                .html(shouldExpand ? '-' : '+');

            select(this.parentElement)
                .select('.prune-details')
                .style('display', shouldExpand ? 'flex' : 'none');
        });

    header.append('span').text(name);

    header.append('span').attr('class', 'toggler').html('+');

    const id = Math.random().toString(32).slice(3);

    const details = selection
        .append('div')
        .attr('class', 'prune-details')
        .style('display', 'none');

    details
        .append('label')
        .text('Smart')
        .append('input')
        .attr('value', 'mad')
        .attr('type', 'radio')
        .attr('name', id)
        .on('click', () => {
            selection.select('svg.mad').style('display', 'flex');
            selection.select('svg.raw').style('display', 'none');
        });
    details
        .append('label')
        .text('Raw')
        .append('input')
        .attr('value', 'raw')
        .attr('type', 'radio')
        .attr('checked', 'checked')
        .attr('name', id)
        .on('click', () => {
            selection.select('svg.raw').style('display', 'flex');
            selection.select('svg.mad').style('display', 'none');
        });

    details
        .append('label')
        .text('Enter Minimum')
        .append('input')
        .attr('type', 'text')
        .attr('class', 'mad')
        .on('keyup', function (e) {
            button.attr('disabled', e?.target?.value ? null : 'disabled');
        });

    details
        .append('svg')
        .attr('class', 'mad')
        .attr('viewBox', [0, 0, 200, 55])
        .style('display', 'none')
        .append('g')
        .attr('transform', 'translate(20,10)')
        .call(
            makeSlider,
            'mad',
            scaleLinear([0, 165]).domain([0, 20]),
            (val: number) =>
                requestAnimationFrame(
                    fn.prune.bind(null, fn.getMedian() + fn.getMad() * +val)
                )
        );

    details
        .append('svg')
        .attr('class', 'raw')
        .attr('width', 250)
        .attr('viewBox', [0, 0, 200, 55])
        .append('g')
        .attr('transform', 'translate(20,10)')
        .call(
            makeSlider,
            'raw',
            scaleLinear([0, 165]).domain(fn.getDomain()),
            (val: number) => requestAnimationFrame(fn.prune.bind(null, val))
        );

    const button = details
        .append('button')
        .text('Update')
        .attr('disabled', 'disabled')
        .on('click', function () {
            const type = getUnitType();

            const value = getInputvalue();

            if (!value) return;

            const num =
                type === 'mad' ? fn.getMedian() + fn.getMad() * +value : value;

            fn.prune(+num);
        });
};

pruneControls.append('div').call(makePruner, 'Set Size', {
    getMad: Tree.getCountMad,
    getMedian: Tree.getCountMedian,
    prune: Tree.setMinCount,
    getDomain: () => [
        0,
        min(Tree.rootPositionedTree.children!.map(d => d.value!))! + 5,
    ],
});

pruneControls.append('div').call(makePruner, 'Set Distance', {
    getMad: Tree.getDistanceMad,
    getMedian: Tree.getDistanceMedian,
    prune: Tree.setMinDistance,
    getDomain: () => [
        0,
        min(
            Tree.rootPositionedTree.children!.flatMap(d =>
                d.children!.map(d => d.data.distance!)
            )
        )! + 0.05,
    ],
});

pruneControls.append('div').call(makePruner, 'Set Distance Search', {
    getMad: Tree.getDistanceMad,
    getMedian: Tree.getDistanceMedian,
    prune: Tree.setMinDistanceSearch,
    getDomain: () => [
        0,
        min(
            Tree.rootPositionedTree.children!.flatMap(d =>
                d.children!.map(d => d.data.distance!)
            )
        )! + 0.05,
    ],
});

pruneControls.append('hr');

pruneControls
    .append('button')
    .text('Tour')
    .on('click', () => tour());

const tour = () => {
    let i = 0;

    setInterval(() => {
        Tree.setMinCount(i);
        i = i += 25;
    }, 1000);
};

const renderControls = () => {
    renderStyleControls();
};

const mad = Tree.getCountMad()!;
const med = Tree.getCountMedian()!;

Tree.render();

renderControls();

legend.raise();
