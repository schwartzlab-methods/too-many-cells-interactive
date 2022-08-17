import React, { useCallback } from 'react';
import styled from 'styled-components';

interface InputProps {
    ml?: string;
    width?: string | number;
}

export const Input = styled.input<InputProps>`
    &:focus,
    &:focus-visible {
        border-color: ${props => props.theme.palette.grey};
        outline: none;
    }
    background-color: ${props => props.theme.palette.white};
    border: 0.1em solid ${props => props.theme.palette.lightGrey};
    border-radius: 4px;
    color: ${props => props.theme.palette.grey};
    padding: 0.75em 0.5em;
    margin-left: ${props => props.ml ?? 'inherit'};
    max-width: ${props => props.width ?? '200px'};
`;

interface NumberInputProps {
    onChange: (arg: string | number) => void;
    style?: React.CSSProperties;
    value: string | number;
}

export const NumberInput: React.FC<NumberInputProps> = ({
    onChange,
    style,
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
            style={style}
            value={value}
        />
    );
};
