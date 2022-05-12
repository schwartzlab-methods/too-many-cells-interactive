import styled from 'styled-components';

export default styled.button<{ active?: boolean; horizontal?: boolean }>`
    background-color: ${props =>
        props.active
            ? props.theme.palette.lightGrey
            : props.theme.palette.white};
    border: 0.1em solid ${props => props.theme.palette.grey};
    border-radius: 0.12em;
    box-sizing: border-box;
    color: ${props => props.theme.palette.grey};
    display: inline-block;
    font-weight: 300;
    padding: 0.35em 1.2em;
    text-align: center;
    text-decoration: none;
    transition: all 0.2s;
    &:hover {
        background-color: ${props => props.theme.palette.lightGrey};
        cursor: pointer;
        &:disabled {
            cursor: auto;
            background-color: inherit;
        }
    }
    + Button {
        margin-left: ${props => (props.horizontal ? '5px' : 'inherity')};
    }
    &:disabled {
        color: ${props => props.theme.palette.lightGrey};
        cursor: auto;
    }
`;
