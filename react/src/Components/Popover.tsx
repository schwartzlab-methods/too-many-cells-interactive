import React, { ReactNode } from 'react';
import styled from 'styled-components';
import {
    Root,
    Anchor as PopoverAnchor,
    Content as PopoverContent,
    Trigger as PopoverTrigger,
    Portal,
} from '@radix-ui/react-popover';

const PopoverContentContainer = styled.div`
    background-color: ${props => props.theme.palette.white};
    border: ${props => `${props.theme.palette.lightGrey} thin solid`};
    border-radius: 5px;
    box-shadow: 0px 3px 1px -2px rgb(0 0 0 / 20%),
        0px 2px 2px 0px rgb(0 0 0 / 14%), 0px 1px 5px 0px rgb(0 0 0 / 12%);
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    flex-shrink: 1;
    justify-content: flex-start;
    max-width: 500px;
    opacity: 1;
    padding: 7px;
    position: absolute;
    z-index: 9999;
`;

interface PopoverProps {
    onOpenChange?: (state: boolean) => void;
    open: boolean;
    Anchor?: ReactNode;
    Content: ReactNode;
    Trigger?: ReactNode;
}

export const Popover: React.FC<PopoverProps> = ({
    onOpenChange,
    open,
    Anchor,
    Content,
    Trigger,
}) => {
    return (
        <Root onOpenChange={onOpenChange} open={open}>
            {Anchor ? (
                <PopoverAnchor>{Anchor}</PopoverAnchor>
            ) : (
                <PopoverTrigger>{Trigger}</PopoverTrigger>
            )}
            <Portal>
                <PopoverContent>
                    <PopoverContentContainer>{Content}</PopoverContentContainer>
                </PopoverContent>
            </Portal>
        </Root>
    );
};

export default Popover;
