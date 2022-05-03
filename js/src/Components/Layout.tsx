import styled from 'styled-components';

export const Column = styled.div`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
`;

export const Row = styled.div<{
    basis?: string;
    margin?: string;
    justifyContent?: string;
}>`
    align-items: center;
    display: flex;
    flex-basis: ${props => props.basis ?? 'auto'};
    flex-direction: row;
    flex-wrap: no-wrap;
    flex-grow: 1;
    justify-content: ${props => props.justifyContent ?? 'flex-start'};
    margin: ${props => props.margin ?? '25px'};
    padding: 10px;
`;
