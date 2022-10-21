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

    const wrappedOnChange = useCallback(
        (arg: string) => {
            // if val is empty string or starts/ends with 0 r ., update internal value but don't push
            if (
                /^(-)?.*(\.|(\.[0-9]*)0)$/.test(arg) ||
                ['', '-', '-.', '-0.'].includes(arg)
            ) {
                setInternalValue(arg);
            } else if (!isNaN(+arg) && !isNaN(parseFloat(arg))) {
                setInternalValue(+arg);
                return onChange(+arg);
            }
            //otherwise (e.g., input is not a number or number-like) do nothing
        },
        [onChange]
    );

    return (
        <Input
            ml={ml}
            onChange={e => wrappedOnChange(e.currentTarget.value)}
            value={internalValue}
        />
    );
};
