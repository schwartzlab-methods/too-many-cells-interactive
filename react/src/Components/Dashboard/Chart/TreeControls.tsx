import React from 'react';
import styled from 'styled-components';
import { saveAs } from 'file-saver';
import Button from '../../Button';
import { Column, Row } from '../../Layout';
import { Bold, Text } from '../../Typography';
import { useAppSelector, useColorScale, useExportState } from '../../../hooks';
import { selectDisplayConfig } from '../../../redux/displayConfigSlice';
import { downloadPng, downloadSvg } from '../../../downloadImage';

const TreeControls: React.FC = () => {
    const { scale: colorScale } = useColorScale();

    const state = useExportState();

    return (
        <Column>
            <Row margin='5px'>
                <Button horizontal onClick={() => downloadSvg(colorScale!)}>
                    Download SVG
                </Button>
                <Button horizontal onClick={() => downloadPng(colorScale!)}>
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
            </Row>
            <Row margin='5px'>
                <PruneStatuses />
            </Row>
        </Column>
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

const StatusContainer = styled(Row)`
    margin: 0px;
    ${Text} {
        + ${Text} {
            margin-left: 5px;
        }
    }
`;

export default TreeControls;
