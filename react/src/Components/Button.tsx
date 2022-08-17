import styled from 'styled-components';

export default styled.button<{
    active?: boolean;
    horizontal?: boolean;
    ml?: string;
}>`
    background-color: ${props =>
        props.disabled
            ? props.theme.palette.lightGrey
            : props.theme.palette.primary};
    border: 0;
    border-radius: 0.25em;
    box-sizing: border-box;
    box-shadow: 0px 3px 1px -2px rgb(0 0 0 / 20%),
        0px 2px 2px 0px rgb(0 0 0 / 14%), 0px 1px 5px 0px rgb(0 0 0 / 12%);
    color: ${props => props.theme.palette.white};
    display: inline-block;
    font-weight: 500;
    margin-left: ${props => props.ml ?? 'inherit'};
    outline: 0;
    padding: 6px 16px;
    text-align: center;
    text-decoration: none;
    text-transform: uppercase;
    transition: all 0.2s;
    &:hover {
        background-color: ${props => props.theme.palette.primaryDark};
        cursor: pointer;
        &:disabled {
            cursor: auto;
            background-color: ${props => props.theme.palette.lightGrey};
        }
    }
    + Button {
        margin-left: ${props => (props.horizontal ? '5px' : 'inherit')};
    }
    &:disabled {
        color: ${props => props.theme.palette.black};
        cursor: auto;
    }
`;
