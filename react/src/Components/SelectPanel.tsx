import React, { useRef } from 'react';
import styled from 'styled-components';
//https://github.com/styled-components/styled-components/issues/1449
import { useClickAway } from '../hooks';
import { RadioButton, RadioLabel } from './Radio';

const SelectPanelContainer = styled.div`
    position: relative;
    width: 100%;
    z-index: 9999;
`;

const SelectPanelPanel = styled.div`
    background-color: ${props => props.theme.palette.white};
    box-shadow: 0px 3px 1px -2px rgb(0 0 0 / 20%),
        0px 2px 2px 0px rgb(0 0 0 / 14%), 0px 1px 5px 0px rgb(0 0 0 / 12%);
    display: flex;
    flex-direction: column;
    border: ${props => `${props.theme.palette.lightGrey} thin solid`};
    border-radius: 5px;
    padding: 8px;
    position: absolute;
`;

interface SelectPanelItemProps {
    name: string | undefined;
    onSelect: (value: string | undefined) => void;
    selected: boolean;
    title: string;
}

function SelectPanelItem({
    name,
    onSelect,
    selected,
    title,
}: SelectPanelItemProps) {
    return (
        <div>
            <RadioButton
                checked={selected}
                id={name ?? title}
                name={name ?? title}
                onChange={onSelect.bind(null, name)}
                type='radio'
            />
            <RadioLabel fontSize='18px' htmlFor={name ?? title}>
                {title}
            </RadioLabel>
        </div>
    );
}

interface SelectPanelItemConfig {
    title: string;
    id: string | undefined;
}

interface SelectPanelProps {
    onClose: () => void;
    onSelect: (selection: string | undefined) => void;
    items: SelectPanelItemConfig[];
    selected?: string;
}

export const SelectPanel: React.FC<SelectPanelProps> = ({
    onClose,
    onSelect,
    items,
    selected,
}) => {
    const containerRef = useRef<any>();

    useClickAway(containerRef, onClose);

    return (
        <SelectPanelContainer ref={containerRef}>
            <SelectPanelPanel>
                {items.map(p => (
                    <div key={p.title}>
                        <SelectPanelItem
                            name={p.id}
                            onSelect={onSelect}
                            selected={selected === p.id}
                            title={p.title}
                        />
                    </div>
                ))}
            </SelectPanelPanel>
        </SelectPanelContainer>
    );
};

interface FlexPanelProps {
    onClose: () => void;
}

export const FlexPanel: React.FC<FlexPanelProps> = ({ onClose, children }) => {
    const containerRef = useRef<any>();

    useClickAway(containerRef, onClose);

    return (
        <SelectPanelContainer ref={containerRef}>
            <SelectPanelPanel>{children}</SelectPanelPanel>
        </SelectPanelContainer>
    );
};
