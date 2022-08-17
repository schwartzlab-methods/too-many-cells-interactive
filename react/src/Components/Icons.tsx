import React from 'react';
import styled from 'styled-components';

interface IconProps {
    pointer?: boolean;
    fill?: string;
    onClick?: () => void;
    size?: string;
    stroke?: string;
    strokeWidth?: number;
}

const Icon = styled.svg<IconProps>`
    cursor: ${props => (props.pointer ? 'pointer' : 'inherit')};
    fill: ${props => props.fill ?? props.theme.palette.grey};
    stroke: ${props => props.stroke ?? props.theme.palette.grey};
    stroke-width: ${props => props.strokeWidth ?? '3px'};
    width: ${props => props.size ?? '20px'};
`;

export const CheckboxCheckedIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox='0 0 24 24'>
        <polyline points='20 6 9 17 4 12' />
    </Icon>
);

export const CheckboxUncheckedIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox='0 0 24 24'>
        <polyline points='0 0, 24 0, 24 24, 0 24, 0 0' />
    </Icon>
);

export const CloseIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox='0 0 50 50' strokeLinecap='round'>
        <line x1='0' y1='0' x2='50' y2='50' />
        <line x1='50' y1='0' x2='0' y2='50' />
    </Icon>
);

export const DotIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox='0 0 20 20'>
        <circle r={props.size || 5} cx={10} cy={10} />
    </Icon>
);

export const RightArrowIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox='0 0 20 20'>
        <path d='M10.029 5H0v7.967h10.029V18l9.961-9.048L10.029 0v5z' />
    </Icon>
);
