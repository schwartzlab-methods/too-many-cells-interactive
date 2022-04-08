import React from 'react';
import styled from 'styled-components';

interface IconProps {
    fill?: string;
    onClick?: () => void;
    size?: string;
    stroke?: string;
    strokeWidth?: number;
}

const Icon = styled.svg<IconProps>`
    fill: ${props => props.fill ?? props.theme.palette.grey};
    stroke: ${props => props.stroke ?? props.theme.palette.grey};
    stroke-width: ${props => props.strokeWidth ?? '3px'};
    width: ${props => props.size ?? '20px'};
`;

export const CheckboxCheckedIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12" />
    </Icon>
);

export const CheckboxUncheckedIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox="0 0 24 24">
        <polyline points="0 0, 24 0, 24 24, 0 24, 0 0" />
    </Icon>
);

export const CaretUpIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox="0 0 1030 638">
        <path d="M1017 570L541 12Q530 0 515 0t-26 12L13 570q-16 19-7 43.5T39 638h952q24 0 33-24.5t-7-43.5z" />
    </Icon>
);

export const CaretDownIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox="0 0 1030 638">
        <path d="M1017 68L541 626q-11 12-26 12t-26-12L13 68Q-3 49 6 24.5T39 0h952q24 0 33 24.5t-7 43.5z" />
    </Icon>
);

export const DotIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox="0 0 20 20">
        <circle r={props.size || 5} cx={10} cy={10} />
    </Icon>
);
