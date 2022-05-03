import React, { useCallback } from 'react';
import styled from 'styled-components';

export const Input = styled.input`
    &:focus,
    &:focus-visible {
        border-color: ${props => props.theme.palette.grey};
        outline: none;
    }
    background-color: ${props => props.theme.palette.white};
    border: 0.1em solid ${props => props.theme.palette.gray};
    color: ${props => props.theme.palette.grey};
    padding: 0.25em 0.5em;
    width: 100px;
`;

interface NumberInputProps {
    onChange: (arg: string | number) => void;
    value: string | number;
}

export const NumberInput: React.FC<NumberInputProps> = ({
    onChange,
    value,
}) => {
    /* user can type a string and we'll convert it to a float as needed */

    const wrappedOnChange = useCallback((arg: string) => {
        if (/\d*\.\d*$/.test(arg) || ['', 0].includes(arg))
            return onChange(arg);
        if (!+arg) {
            return value;
        }
        return onChange(+arg);
    }, []);

    return (
        <Input
            onChange={e => wrappedOnChange(e.currentTarget.value)}
            value={value}
        />
    );
};
