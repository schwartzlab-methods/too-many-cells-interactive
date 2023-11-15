import React, { useState } from 'react';
import { Text } from './Typography';
import { Popover } from '.';

interface ToolTipProps {
    message: React.ReactNode;
}

const ToolTip: React.FC<ToolTipProps> = ({ message, children }) => {
    const [tipVisible, setTipVisible] = useState(false);

    return (
        <span
            onMouseEnter={() => setTipVisible(true)}
            onMouseLeave={() => setTipVisible(false)}
        >
            <Popover
                open={tipVisible}
                Anchor={<span>{children}</span>}
                Content={
                    <div
                        style={{
                            display: 'flex',
                            flexGrow: 1,
                        }}
                    >
                        {React.isValidElement(message) ? (
                            message
                        ) : (
                            <Text fontSize='12px'>{message}</Text>
                        )}
                    </div>
                }
            />
        </span>
    );
};

export default ToolTip;
