import React from 'react';
import styled, { useTheme } from 'styled-components';
import { useMediaQuery } from '../hooks';
import theme from '../theme';
import { Caption, Title } from './Typography';

interface ColProps {
    alignItems?: string;
    justifyContent?: string;
    width?: string;
}

interface RowProps extends ColProps {
    margin?: string;
    padding?: string;
}

export const Column = styled.div<ColProps>`
    align-items: ${props => props.alignItems ?? 'flex-start'};
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    justify-content: ${props => props.justifyContent ?? 'flex-start'};
    width: ${props => props.width ?? '100%'};
`;

export const Row = styled.div<RowProps>`
    align-items: ${props => props.alignItems ?? 'center'};
    display: flex;
    width: ${props => props.width ?? '100%'};
    flex-direction: row;
    flex-wrap: no-wrap;
    flex-grow: 1;
    justify-content: ${props => props.justifyContent ?? 'flex-start'};
    padding: ${props => props.padding ?? '5px'};
    margin: ${props => props.margin ?? '0px'};
`;

interface ResponsiveRowProps extends RowProps {
    lgUp?: boolean;
    mdUp?: boolean;
}

export const ResponsiveRow: React.FC<ResponsiveRowProps> = ({
    alignItems,
    children,
    justifyContent,
    lgUp,
    margin,
    width,
}) => {
    const _theme = useTheme() as typeof theme;

    const breakpoint = lgUp ? _theme.breakpoints.lg : _theme.breakpoints.md;
    const matches = useMediaQuery(`(min-width: ${breakpoint})`);

    const rowProps = { alignItems, justifyContent, margin, width };
    const colProps = {
        justifyContent: alignItems,
        alignItems: justifyContent,
        width,
    };

    return matches ? (
        <Row {...rowProps}>{children}</Row>
    ) : (
        <Column {...colProps}>{children}</Column>
    );
};

const WidgetSectionColumn = styled(Column)`
    margin: 10px 0px;
`;

interface WidgetSectionProps {
    caption?: string;
    title: string;
}

export const WidgetSection: React.FC<WidgetSectionProps> = ({
    caption,
    children,
    title,
}) => (
    <WidgetSectionColumn>
        <Row>
            <Column>
                <Title>{title}</Title>
                <Caption>{caption}</Caption>
            </Column>
        </Row>
        <Row>{children}</Row>
    </WidgetSectionColumn>
);
