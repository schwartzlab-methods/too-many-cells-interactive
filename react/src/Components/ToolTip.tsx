import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import { Text } from './Typography';

interface ToolTipProps {
    message: React.ReactNode;
}

const Container = styled.div`
    display: flex;
    position: relative;
`;

const ToolTipItem = styled.div<{ bottom?: number; top?: number }>`
    background-color: ${props => props.theme.palette.grey};
    border-radius: 5px;
    bottom: ${props => (props.bottom ? `${props.bottom}px` : 'inherit')};
    color: ${props => props.theme.palette.white};
    flex-grow: 1;
    flex-shrink: 1;
    justify-content: flex-start;
    padding: 7px;
    position: absolute;
    top: ${props => (props.top ? `${props.top}px` : 'inherit')};
`;

const ToolTip: React.FC<ToolTipProps> = ({ message, children }) => {
    const [tipVisible, setTipVisible] = useState(false);
    const containerRef = useRef<HTMLSpanElement>(null);

    const getShowAtTop = () =>
        !!containerRef.current &&
        containerRef.current.getBoundingClientRect().top > 150;

    const getParentHeight = () =>
        containerRef.current?.getBoundingClientRect().height || 0;

    return (
        <span
            onMouseEnter={() => setTipVisible(true)}
            onMouseLeave={() => setTipVisible(false)}
        >
            <span ref={containerRef}>{children}</span>
            <Container>
                {tipVisible && (
                    <ToolTipItem
                        bottom={getShowAtTop() ? getParentHeight() * 2 : 0}
                        top={!getShowAtTop() ? 5 : 0}
                    >
                        {React.isValidElement(message) ? (
                            message
                        ) : (
                            <Text color={'white'} fontSize='12px'>
                                {message}
                            </Text>
                        )}
                    </ToolTipItem>
                )}
            </Container>
        </span>
    );
};

export default ToolTip;
