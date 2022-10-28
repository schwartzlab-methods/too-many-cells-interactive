import React from 'react';
import styled from 'styled-components';
import { QuestionMarkIcon } from './Icons';
import ToolTip from './ToolTip';

interface QuestionTipProps {
    message: React.ReactNode;
}

const QuestionContainer = styled.span`
    margin-left: 5px;
`;

const QuestionTip: React.FC<QuestionTipProps> = ({ message }) => (
    <QuestionContainer>
        <ToolTip message={message}>
            <QuestionMarkIcon size={'15px'} pointer />
        </ToolTip>
    </QuestionContainer>
);

export default QuestionTip;
