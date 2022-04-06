import React, { useContext, useMemo } from 'react';
import styled from 'styled-components';
import Button from '../../Button';
import { BaseTreeContext, TreeContext } from '../Dashboard';

const DisplayButtons: React.FC = () => {
    return (
        <ButtonList>
            <ToggleButton label="Stroke" propName="strokeVisible" />
            <ToggleButton label="Node IDs" propName="nodeIdsVisible" />
            <ToggleButton label="Node Counts" propName="nodeCountsVisible" />
            <ToggleButton label="Distance" propName="distanceVisible" />
            <ToggleButton label="Pies" propName="piesVisible" />
        </ButtonList>
    );
};

export default DisplayButtons;

interface ToggleButtonProps {
    propName: keyof BaseTreeContext;
    label: string;
}

const ToggleButton: React.FC<ToggleButtonProps> = ({ propName, label }) => {
    const treeContext = useContext(TreeContext);
    const active = useMemo(() => !!treeContext[propName], [treeContext]);

    const toggleTreeProp = (prop: keyof BaseTreeContext) =>
        treeContext.setTreeContext!({
            ...treeContext,
            [prop]: !treeContext[prop],
        });

    return (
        <Button active={active} onClick={() => toggleTreeProp(propName)}>
            {`${active ? 'Hide' : 'Show'} ${label}`}
        </Button>
    );
};

const ButtonList = styled('div')`
    display: flex;
    flex-direction: column;
    width: 200px;
`;
