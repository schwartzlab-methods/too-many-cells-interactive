import React, { useCallback, useEffect, useState } from 'react';
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

//typing is bad for reuse via attrs.as, so we'll just copy/paste for now

export const TextArea = styled.textarea<InputProps>`
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

interface NumberInputProps extends InputProps {
    onChange: (arg: number | undefined) => void;
    value: number;
}

export const NumberInput: React.FC<NumberInputProps> = ({
    onChange,
    ml,
    value,
}) => {
    const [internalValue, setInternalValue] = useState<
        number | string | undefined
    >(+value || 0);

    useEffect(() => {
        setInternalValue(value);
    }, [value]);

    const wrappedOnChange = useCallback((arg: string) => {
        //if it starts with a dot, is an empty string, or is in the form .000 update internal value but don't push
        if (arg === '' || /^\d*\.0*$/.test(arg)) {
            setInternalValue(arg);
        }
        //this is when we have a fully valid number that can be consumed by a number-expecting parent
        else if (/^\d*(\.\d+)?$/.test(arg)) {
            setInternalValue(+arg);
            return onChange(+arg);
        }
        //otherwise (e.g., input is not a number) do nothing
    }, []);

    return (
        <Input
            ml={ml}
            onChange={e => wrappedOnChange(e.currentTarget.value)}
            value={internalValue}
        />
    );
};
