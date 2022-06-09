import React, { useContext } from 'react';
import { max, min } from 'd3-array';
import { ScaleOrdinal } from 'd3-scale';
import { BaseType, select } from 'd3-selection';
import styled from 'styled-components';
import { saveAs } from 'file-saver';
import Button from '../../Button';
import { Column, Row } from '../../Layout';
import { TreeContext } from '../Dashboard';
import { Bold, Text } from '../../Typography';

const getSvgSrc = (colorScale: ScaleOrdinal<string, string>) => {
    const svg = select('svg');

    const [w, h] = svg
        .attr('viewBox')
        .split(',')
        .slice(2)
        .map(d => +d);

    svg.select('g.container')
        .append('g')
        .attr('transform', `translate(${w / 2 - 150}, ${h / 2})`)
        .attr('class', 'legend')
        .selectAll('g.item')
        .data(colorScale.domain())
        .join('g')
        .each(function (_, i) {
            const g = select<SVGGElement | BaseType, string>(this)
                .attr('class', 'item')
                .attr('transform', `translate(0,${i * -15})`);

            g.append('circle')
                .text(d => d)
                .attr('r', 4)
                .attr('cy', -6)
                .attr('fill', d => colorScale(d));

            g.append('text')
                .text(d => d)
                .attr('dx', 5);
        });

    const svgNode = svg
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('version', 1.1)
        .node() as Element;

    const inner = svgNode.parentElement!.innerHTML;

    return `data:image/svg+xml;base64,\n${window.btoa(inner)}`;
};

const removeLegend = () => select('svg').select('g.legend').remove();

const downloadPng = (colorScale: ScaleOrdinal<string, string>) => {
    try {
        const w = (select('svg').node() as Element).clientWidth;
        const h = (select('svg').node() as Element).clientHeight;

        const src = getSvgSrc(colorScale);

        const canvas = document.createElement('canvas')!;
        const context = canvas.getContext('2d')!;

        canvas.width = w;
        canvas.height = h;

        const image = new Image();
        image.src = src;
        image.onload = function () {
            context.clearRect(0, 0, w, h);
            context.drawImage(image, 0, 0, w, h);

            canvas.toBlob(function (blob) {
                saveAs(blob!, 'my-tree.png');
            });
        };
    } finally {
        removeLegend();
    }
};

const downloadSvg = (colorScale: ScaleOrdinal<string, string>) => {
    try {
        const svgSrc = getSvgSrc(colorScale);
        saveAs(svgSrc);
    } finally {
        removeLegend();
    }
};

const TreeControls: React.FC = () => {
    const {
        displayContext: { colorScale },
    } = useContext(TreeContext);
    return (
        <Column>
            <Row margin="5px">
                <Button horizontal onClick={() => downloadSvg(colorScale!)}>
                    Download SVG
                </Button>
                <Button horizontal onClick={() => downloadPng(colorScale!)}>
                    Download PNG
                </Button>
            </Row>
            <Row margin="5px">
                <PruneStatuses />
            </Row>
        </Column>
    );
};

const PruneStatuses: React.FC = () => {
    const {
        displayContext: { visibleNodes },
    } = useContext(TreeContext);

    return (
        <StatusContainer>
            <Text>
                <Bold>Node count:</Bold>{' '}
                {visibleNodes?.descendants().length?.toLocaleString()}
            </Text>
            <Text>
                <Bold>Leaf count:</Bold>{' '}
                {visibleNodes?.leaves().length?.toLocaleString()}
            </Text>
            <Text>
                <Bold>Min value:</Bold>{' '}
                {min(
                    (visibleNodes?.descendants() || []).map(d => d.value!)
                )?.toLocaleString()}
            </Text>
            <Text>
                <Bold>Max value:</Bold>{' '}
                {max(
                    (visibleNodes?.descendants() || []).map(d => d.value!)
                )?.toLocaleString()}
            </Text>
        </StatusContainer>
    );
};

const StatusContainer = styled(Row)`
    margin: 0px;
    ${Text} {
        + ${Text} {
            margin-left: 5px;
        }
    }
`;

export default TreeControls;
