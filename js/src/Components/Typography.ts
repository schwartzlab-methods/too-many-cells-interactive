import React from 'react';
import styled from 'styled-components';

export const Text = styled.p`
    margin: 0px;
    font-size: 16px;
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
