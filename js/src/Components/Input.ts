import styled from 'styled-components';

export default styled.input`
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
