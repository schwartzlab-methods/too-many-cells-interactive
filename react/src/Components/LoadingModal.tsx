import React from 'react';
import ClipLoader from 'react-spinners/ClipLoader';
import { Modal, Text } from '.';

interface LoadingModalProps {
    open: boolean;
    message?: string;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ open, message }) => (
    <Modal open={open}>
        <>
            <Text>{message || 'Loading...'}</Text>
            <ClipLoader />
        </>
    </Modal>
);

export default LoadingModal;
