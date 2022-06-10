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
    & + & {
        margin-top: 10px;
    }
`;

interface CheckboxProps {
    checked: boolean;
    label: string;
    onClick: () => void;
    style?: React.CSSProperties;
}

const Checkbox: React.FC<CheckboxProps> = ({
    checked,
    label,
    onClick,
    style,
}) => {
    return (
        <CheckboxContainer style={style} onClick={onClick}>
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
