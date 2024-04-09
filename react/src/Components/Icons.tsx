import React from 'react';
import styled from 'styled-components';

/* Some simple homespun SVG icons */

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

export const QuestionMarkIcon: React.FC<IconProps> = props => (
    <Icon {...props} viewBox='0 0 91.999 92'>
        <path d='M45.385,0.004C19.982,0.344-0.334,21.215,0.004,46.619c0.34,25.393,21.209,45.715,46.611,45.377  c25.398-0.342,45.718-21.213,45.38-46.615C91.655,19.986,70.785-0.335,45.385,0.004z M45.249,74l-0.254-0.004  c-3.912-0.116-6.67-2.998-6.559-6.852c0.109-3.788,2.934-6.538,6.717-6.538l0.227,0.004c4.021,0.119,6.748,2.972,6.635,6.937  C51.903,71.346,49.122,74,45.249,74z M61.704,41.341c-0.92,1.307-2.943,2.93-5.492,4.916l-2.807,1.938  c-1.541,1.198-2.471,2.325-2.82,3.434c-0.275,0.873-0.41,1.104-0.434,2.88l-0.004,0.451H39.429l0.031-0.907  c0.131-3.728,0.223-5.921,1.768-7.733c2.424-2.846,7.771-6.289,7.998-6.435c0.766-0.577,1.412-1.234,1.893-1.936  c1.125-1.551,1.623-2.772,1.623-3.972c0-1.665-0.494-3.205-1.471-4.576c-0.939-1.323-2.723-1.993-5.303-1.993  c-2.559,0-4.311,0.812-5.359,2.478c-1.078,1.713-1.623,3.512-1.623,5.35v0.457H27.935l0.02-0.477  c0.285-6.769,2.701-11.643,7.178-14.487C37.946,18.918,41.446,18,45.53,18c5.346,0,9.859,1.299,13.412,3.861  c3.6,2.596,5.426,6.484,5.426,11.556C64.368,36.254,63.472,38.919,61.704,41.341z' />
    </Icon>
);
