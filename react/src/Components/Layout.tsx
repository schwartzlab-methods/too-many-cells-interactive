import React from 'react';
import styled from 'styled-components';
import QuestionTip from './QuestionTip';
import { Caption, Title } from './Typography';

interface RowProps {
    alignItems?: string;
    justifyContent?: string;
}

//2 accounts for 2% "gutter" margin
const media = {
    xs: (cols: number) => `  
        flex-basis: ${(cols / 12) * 100 - 2}%;
    `,
    md: (cols: number) => `
        @media only screen and (min-width: 1238px) {
            flex-basis: ${(cols / 12) * 100 - 2}%;
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
        margin-left: 2%;
    }
    ${props => media.xs(props.xs)}
    ${props => props.md && media.md(props.md)}
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
    helpText?: React.ReactNode;
    title: string;
}

export const WidgetTitle: React.FC<WidgetTitleProps> = ({
    caption,
    helpText,
    title,
}) => (
    <TitleContainer xs={12}>
        <Row>
            <Title>{title}</Title>
            {!!helpText && <QuestionTip message={helpText} />}
        </Row>
        <Row>
            <Caption>{caption}</Caption>
        </Row>
    </TitleContainer>
);
