import React from 'react';
import styled from 'styled-components';
import { RadioButton, RadioLabel } from './Radio';
import { Popover } from '.';

const SelectPanelContent = styled.div`
    width: 250px;
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
    open: boolean;
    items: SelectPanelItemConfig[];
    selected?: string;
}

export const SelectPanel: React.FC<SelectPanelProps> = ({
    children,
    onClose,
    onSelect,
    open,
    items,
    selected,
}) => {
    return (
        <Popover
            open={open}
            onOpenChange={onClose}
            Anchor={children}
            Content={
                <SelectPanelContent>
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
                </SelectPanelContent>
            }
        />
    );
};
