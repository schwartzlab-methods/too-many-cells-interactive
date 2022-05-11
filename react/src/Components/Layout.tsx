import styled from 'styled-components';

export const Column = styled.div<{
    alignItems?: string;
    justifyContent?: string;
    width?: string;
}>`
    align-items: ${props => props.alignItems ?? 'flex-start'};
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    justify-content: ${props => props.justifyContent ?? 'flex-start'};
    width: ${props => props.width ?? '100%'};
`;

export const Row = styled.div<{
    alignItems?: string;
    justifyContent?: string;
    margin?: string;
    width?: string;
}>`
    align-items: ${props => props.alignItems ?? 'center'};
    display: flex;
    width: ${props => props.width ?? '100%'};
    flex-direction: row;
    flex-wrap: no-wrap;
    flex-grow: 1;
    justify-content: ${props => props.justifyContent ?? 'flex-start'};
    margin: ${props => props.margin ?? '25px'};
    padding: 10px;
`;
