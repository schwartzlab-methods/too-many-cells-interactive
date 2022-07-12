import styled from 'styled-components';

export const Text = styled.p`
    margin: 0px;
    font-size: 16px;
`;

export const Bold = styled.span`
    font-weight: bold;
`;

export const Primary = styled.span`
    color: ${props => props.theme.palette.primary};
`;

export const Accent = styled.span`
    color: ${props => props.theme.palette.secondary};
`;

export const Main = styled.h2`
    font-size: 32px;
    margin: 5px;
`;

export const Title = styled.h3`
    font-size: 24px;
`;

export const Caption = styled.p`
    margin: 0px;
    font-size: 12px;
    color: ${props => props.theme.palette.grey};
`;

export const Label = styled.label`
    margin: 0px;
    font-size: 16px;
    color: ${props => props.theme.palette.grey};
`;
