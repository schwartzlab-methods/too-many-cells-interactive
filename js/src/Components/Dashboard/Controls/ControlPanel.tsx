import React from 'react';
import styled from 'styled-components';
import DisplayButtons from './DisplayButtons';
import PrunerPanel from './PrunerPanel';

const ControlPanel: React.FC = () => {
    return (
        <Group>
            <DisplayButtons />
            <PrunerPanel />
        </Group>
    );
};

const Group = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: no-wrap;
    flex-grow: 1;
    margin: 5px;
    padding: 10px;
`;

export default ControlPanel;
