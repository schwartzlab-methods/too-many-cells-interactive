import styled from 'styled-components';
import { Label } from './Typography';

export const RadioButton = styled.input.attrs({ type: 'radio' })`
    margin: 0px;
    margin-right: 3px;
`;

export const RadioGroup = styled.div`
    align-items: center;
    display: flex;
    margin-top: 5px;
`;

export const RadioLabel = styled(Label)`
    margin-left: 3px;
    cursor: pointer;
    font-size: 12px;
    + input[type='radio'] {
        margin-left: 3px;
    }
`;
