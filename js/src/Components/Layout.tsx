import styled from 'styled-components';

export const Column = styled.div`
    display: flex;
    flex-direction: column;
`;

export const Row = styled.div<{ basis?: string }>`
    flex-basis: ${props => props.basis ?? 'auto'};
    display: flex;
    flex-direction: row;
    flex-wrap: no-wrap;
    flex-grow: 1;
    margin: 25px;
    padding: 10px;
`;
