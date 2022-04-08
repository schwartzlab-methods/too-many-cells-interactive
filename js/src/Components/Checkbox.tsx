import React from 'react';
import styled from 'styled-components';
import { CheckboxCheckedIcon, CheckboxUncheckedIcon } from './Icons';

const CheckboxLabel = styled.p`
    margin: 0px 0px 0px 5px;
`;

const CheckboxContainer = styled.div`
    align-items: center;
    cursor: pointer;
    display: flex;
    + {CheckboxContainer} {
        margin-bottom: 10px;
    }
`;

interface CheckboxProps {
    checked: boolean;
    label: string;
    onClick: () => void;
}

const Checkbox: React.FC<CheckboxProps> = ({ checked, label, onClick }) => {
    return (
        <CheckboxContainer onClick={onClick}>
            {checked ? (
                <CheckboxCheckedIcon fill="none" />
            ) : (
                <CheckboxUncheckedIcon fill="none" />
            )}
            <CheckboxLabel>{label}</CheckboxLabel>
        </CheckboxContainer>
    );
};

export default Checkbox;
