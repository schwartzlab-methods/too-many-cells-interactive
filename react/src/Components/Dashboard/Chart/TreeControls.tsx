import React from 'react';
import { select } from 'd3-selection';
import styled from 'styled-components';
import { saveAs } from 'file-saver';
import Button from '../../Button';
import { Row } from '../../Layout';

const getSvgString = () => {
    const svgNode = select('svg')
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('version', 1.1)
        .node() as Element;

    return svgNode.parentElement!.innerHTML;
};

const encodeSvgString = (svgString: string) =>
    `data:image/svg+xml;base64,\n${window.btoa(svgString)}`;

const getSvgSrc = () => encodeSvgString(getSvgString());

const TreeControls: React.FC = () => {
    return (
        <Row>
            <Button onClick={() => saveAs(getSvgSrc())}>Download SVG</Button>
            <Button
                onClick={() => {
                    const w = (select('svg').node() as Element).clientWidth;
                    const h = (select('svg').node() as Element).clientHeight;

                    const src = getSvgSrc();
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
                            saveAs(blob!, 'pretty image.png');
                        });
                    };
                }}
            >
                Download PNG
            </Button>
        </Row>
    );
};

export default TreeControls;
