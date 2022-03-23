import exp from 'constants';
import { select, Selection } from 'd3-selection';
import './style.scss';
import TreeViz, { drawLegend } from './Tree';

const styleControls = select('body .controls-container .style-controls');
const pruneControls = select('body .controls-container .prune-controls');

const Tree = new TreeViz('.viz-container');

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
        .call(makeToggle, 'Modularity', Tree.toggleDistance);

    styleControls
        .append('button')
        .call(makeToggle, 'Pies', Tree.togglePies, Tree.piesVisible);

    styleControls
        .append('div')
        .attr('class', 'legend')
        .attr('data', 'foo')
        .call(drawLegend);
};

const makePruner = (
    selection: Selection<HTMLDivElement, unknown, any, unknown>,
    name: string,
    fn: (input: number) => void
) => {
    const update = (data: number) => selection.attr('data', data);

    const clear = (selector: 'mad' | 'raw') =>
        (selection.select<HTMLInputElement>(`.${selector}`).node()!.checked =
            false);
    selection.attr('class', 'prune-container');

    selection.attr('class', 'prune-container');

    const header = selection
        .append('div')
        .attr('class', 'header')
        .on('click', function () {
            const expanded =
                selection.select<HTMLInputElement>(`.header`).attr('data') ==
                'expanded';

            select(this)
                .attr('data', expanded ? 'collapsed' : 'expanded')
                .select('.toggler')
                .html(expanded ? '-' : '+');

            select('.prune-details').style(
                'display',
                expanded ? 'flex' : 'none'
            );
        });

    header.append('span').text(name);

    header.append('span').attr('class', 'toggler').html('+');

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
        .attr('name', 'type');

    details
        .append('label')
        .text('Raw')
        .attr('selected', true)
        .append('input')
        .attr('type', 'radio')
        .attr('checked', 'checked')
        .attr('name', 'type');

    details
        .append('label')
        .text('Enter Minimum')
        .append('input')
        .attr('type', 'text')
        .attr('class', 'mad')
        .on('change', e => update(e.currentTarget.value));

    details
        .append('button')
        .text('Submit')
        .attr('disabled', function () {
            return !select(this.parentElement)
                .select<HTMLInputElement>('input[type=text]')
                .node()?.value;
        })
        .on('click', function () {
            const type = select(this.parentElement)
                .select<HTMLInputElement>('input[type=radio]')
                .node()?.value;

            const value = select(this.parentElement)
                .select<HTMLInputElement>('input[type=text]')
                .node()?.value;

            console.log(type, value);
        });
};

pruneControls.append('div').call(makePruner, 'Set Size');

pruneControls
    .append('button')
    .text('Set minsize to 30')
    .on('click', () => Tree.setMinSize(30));

pruneControls
    .append('button')
    .text('Set minsize to 0')
    .on('click', () => Tree.setMinSize(0));

const input = pruneControls.append('input');

pruneControls
    .append('button')
    .text('Set min count')
    .on('click', () => Tree.setMinSize(+input.node()!.value));

const madInput = pruneControls.append('input');

pruneControls
    .append('button')
    .text('Set min MAD')
    .on('click', () => Tree.setMaxMAD(+madInput.node()!.value));

const minDistance = pruneControls.append('input');

pruneControls
    .append('button')
    .text('Set min distance')
    .on('click', () => Tree.setMinDistance(+minDistance.node()!.value));

pruneControls
    .append('button')
    .text('Tour')
    .on('click', () => tour());

const tour = () => {
    let i = 0;

    setInterval(() => {
        Tree.setMinSize(i);
        i = i += 15;
    }, 2000);
};

const renderControls = () => {
    renderStyleControls();
};

Tree.render();

renderControls();
