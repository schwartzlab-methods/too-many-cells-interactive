import React from 'react';
import styled from 'styled-components';
import {
    CaretUpIcon,
    CheckboxCheckedIcon,
    CheckboxUncheckedIcon,
} from './Icons';

const Icon = styled.svg`
    fill: none;
    stroke: ${props => props.theme.palette.grey};
    stroke-width: 5px;
`;

const CheckboxLabel = styled.p`
    margin-left: 5px;
`;

const CheckboxContainer = styled.div`
    align-items: center;
    cursor: pointer;
    display: flex;
`;

interface CheckboxProps {
    checked: boolean;
    label: string;
    onClick: () => void;
}

const Checkbox: React.FC<CheckboxProps> = ({ checked, label, onClick }) => {
    return (
        <CheckboxContainer onClick={onClick}>
            {checked ? <CheckboxCheckedIcon /> : <CheckboxUncheckedIcon />}
            <CheckboxLabel>{label}</CheckboxLabel>
        </CheckboxContainer>
    );
};

export default Checkbox;
