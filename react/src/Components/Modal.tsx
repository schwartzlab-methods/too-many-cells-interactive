import React from 'react';
import styled from 'styled-components';
import { Text } from './Typography';

const Background = styled.div<{ open: boolean }>`
    background-color: rgba(0, 0, 0, 0.5);
    position: fixed;
    z-index: 3;
    right: 0;
    bottom: 0;
    top: 0;
    left: 0;
    visibility: ${props => (props.open ? 'visible' : 'hidden')};
`;

const ModalContainer = styled.div`
    align-items: center;
    background-color: white;
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    height: 20%;
    justify-content: center;
    left: 40%;
    opacity: 1;
    padding: 10px;
    position: absolute;
    top: 40%;
    width: 20%;
    z-index: 4;
`;

interface ModalProps {
    open: boolean;
    message: string;
}

const Modal: React.FC<ModalProps> = ({ message, open }) => {
    return (
        <Background open={open}>
            <ModalContainer>
                <Text>{message}</Text>
            </ModalContainer>
        </Background>
    );
};

export default Modal;
