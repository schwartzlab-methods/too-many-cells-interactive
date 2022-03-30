import { max, min } from 'd3-array';
import { scaleLinear, ScaleLinear } from 'd3-scale';
import { select, Selection } from 'd3-selection';
import { sliderBottom } from 'd3-simple-slider';
import './style.scss';
import TreeViz from './Tree';

const styleControls = select('body .controls-container .style-controls');
const pruneControls = select('body .controls-container .prune-controls');

const legend = styleControls.append('div').attr('class', 'legend');

const Tree = new TreeViz('.viz-container', '.legend');

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
        .on('onchange', (val: number) => {
            onChange(val);
        });

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
            (val: number) => {
                Tree.transitionTime = 1;
                fn.prune(fn.getMedian() + fn.getMad() * +val);
                Tree.transitionTime = 250;
            }
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
            (val: number) => {
                Tree.transitionTime = 1;
                fn.prune(val);
                Tree.transitionTime = 250;
            }
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

Tree.render();

renderControls();

legend.raise();
