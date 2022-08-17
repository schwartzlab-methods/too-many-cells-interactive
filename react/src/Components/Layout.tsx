import React from 'react';
import styled from 'styled-components';
import { Caption, Title } from './Typography';

interface RowProps {
    alignItems?: string;
    justifyContent?: string;
}

const media = {
    xs: (cols: number) => `  
        flex-basis: ${(cols / 12) * 100}%
    `,
    md: (cols: number) => `
        @media only screen and (min-width: 480px) and (max-width: 767px) {
            flex-basis: ${(cols / 12) * 100}%
        }
    `,
    lg: (cols: number) => `
        @media only screen and (min-width: 768px) {
            flex-basis: ${(cols / 12) * 100}%
        }
    `,
};

interface ColProps extends RowProps {
    xs: number;
    md?: number;
    lg?: number;
}

export const Column = styled.div<ColProps>`
    align-items: ${props => props.alignItems ?? 'flex-start'};
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    flex-shrink: 1;
    justify-content: ${props => props.justifyContent ?? 'flex-start'};
    & + & {
        margin-left: 15px;
    }
    ${props => media.xs(props.xs)}
    ${props => props.md && media.xs(props.md)}
    ${props => props.lg && media.xs(props.lg)}
`;

export const Row = styled.div<RowProps>`
    align-items: ${props => props.alignItems ?? 'center'};
    display: flex;
    flex-direction: row;
    flex-grow: 1;
    flex-shrink: 1;
    flex-wrap: wrap;
    justify-content: ${props => props.justifyContent ?? 'flex-start'};
    & + & {
        margin-top: 15px;
    }
    width: 100%;
`;

const TitleContainer = styled(Column)`
    margin-bottom: 10px;
`;

interface WidgetTitleProps {
    caption?: string;
    title: string;
}

export const WidgetTitle: React.FC<WidgetTitleProps> = ({ caption, title }) => (
    <TitleContainer xs={12}>
        <Title>{title}</Title>
        <Caption>{caption}</Caption>
    </TitleContainer>
);
