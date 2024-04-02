import React from 'react';
import styled from 'styled-components';
import { Row } from '../../Layout';
import { Bold, Text } from '../../Typography';
import { useAppSelector } from '../../../hooks';
import { selectDisplayConfig } from '../../../redux/displayConfigSlice';

/* Wrapper for prune statuses */
const TreeControls: React.FC = () => {
    return (
        <Row>
            <PruneStatuses />
        </Row>
    );
};

/* Summary numbers for the tree, appear above the tree in the view panel. */
const PruneStatuses: React.FC = () => {
    const {
        treeMetadata: { leafCount, minValue, maxValue, nodeCount },
    } = useAppSelector(selectDisplayConfig);

    return (
        <StatusContainer>
            <Text>
                <Bold>Node count:</Bold> {nodeCount}
            </Text>
            <Text>
                <Bold>Leaf count:</Bold> {leafCount}
            </Text>
            <Text>
                <Bold>Min value:</Bold> {minValue}
            </Text>
            <Text>
                <Bold>Observation total:</Bold>{' '}
                {(maxValue || 0).toLocaleString()}
            </Text>
        </StatusContainer>
    );
};

/* Container for the summary numbers */
const StatusContainer = styled.div`
    display: flex;
    ${Text} {
        + ${Text} {
            margin-left: 5px;
        }
    }
`;

export default TreeControls;
