import React from 'react';
import styled from 'styled-components';
import { saveAs } from 'file-saver';
import Button from '../../Button';
import { Column, Row } from '../../Layout';
import { Bold, Text } from '../../Typography';
import {
    useAppSelector,
    useColorScale,
    useDownloadNodeMeta,
    useExportState,
    useSelectTree,
} from '../../../hooks';
import { selectDisplayConfig } from '../../../redux/displayConfigSlice';
import { downloadPng, downloadSvg } from '../../../downloadImage';

const TreeControls: React.FC = () => {
    const { scale: colorScale } = useColorScale();

    useDownloadNodeMeta();

    const state = useExportState();

    const { selector } = useSelectTree();

    const downloadMeta = useDownloadNodeMeta();

    return (
        <div>
            <Row>
                <Button
                    horizontal
                    onClick={() => downloadSvg(colorScale!, selector)}
                >
                    Download SVG
                </Button>
                <Button
                    horizontal
                    onClick={() => downloadPng(colorScale!, selector)}
                >
                    Download PNG
                </Button>
                <Button
                    horizontal
                    onClick={() => {
                        saveAs(
                            `data:text/json,${encodeURIComponent(
                                JSON.stringify(state)
                            )}`,
                            'tmc-state-export.json'
                        );
                    }}
                >
                    Export State
                </Button>
                <Button horizontal onClick={() => downloadMeta('csv')}>
                    Download csv
                </Button>
                <Button horizontal onClick={() => downloadMeta('json')}>
                    Download JSON
                </Button>
            </Row>
            <Row>
                <PruneStatuses />
            </Row>
        </div>
    );
};

const PruneStatuses: React.FC = () => {
    const {
        treeMetadata: { leafCount, minValue, maxValue, nodeCount },
    } = useAppSelector(selectDisplayConfig);

    return (
        <StatusContainer>
            <Text>
                <Bold>Observation count:</Bold> {nodeCount}
            </Text>
            <Text>
                <Bold>Leaf count:</Bold> {leafCount}
            </Text>
            <Text>
                <Bold>Min value:</Bold> {minValue}
            </Text>
            <Text>
                <Bold>Max value:</Bold> {(maxValue || 0).toLocaleString()}
            </Text>
        </StatusContainer>
    );
};

const StatusContainer = styled.div`
    display: flex;
    ${Text} {
        + ${Text} {
            margin-left: 5px;
        }
    }
`;

export default TreeControls;
