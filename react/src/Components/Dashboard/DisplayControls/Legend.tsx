import React, { useContext, useRef, useState } from 'react';
import styled from 'styled-components';
import { HexColorPicker } from 'react-colorful';
import useClickAway from '../../../hooks/useClickAway';
import { DotIcon } from '../../Icons';
import { TreeContext } from '../Dashboard';
import { Column } from '../../Layout';
import { Input } from '../../Input';

const Legend: React.FC = () => {
    const { displayContext, setDisplayContext } = useContext(TreeContext);

    return (
        <Column>
            {displayContext.colorScale &&
                displayContext.colorScale
                    .domain()
                    .sort((a, b) => (a < b ? -1 : 1))
                    .map(d => (
                        <LegendItem
                            key={d}
                            label={d}
                            color={displayContext.colorScale!(d)}
                            updateColor={(color: string) => {
                                const currColor = displayContext.colorScale!(d);
                                const newRange = displayContext
                                    .colorScale!.range()
                                    .map(r => (currColor === r ? color : r));

                                displayContext.colorScale?.range(newRange);

                                setDisplayContext({
                                    colorScale: displayContext.colorScale,
                                });
                            }}
                        />
                    ))}
        </Column>
    );
};

const LegendDot = styled(DotIcon)`
    cursor: pointer;
`;

interface LegendItemProps {
    color: string;
    label: string;
    updateColor: (color: string) => void;
}

const LegendItem: React.FC<LegendItemProps> = ({
    color,
    label,
    updateColor,
}) => {
    const [pickerOpen, setPickerOpen] = useState(false);
    const containerRef = useRef<any>();

    useClickAway(containerRef, () => setPickerOpen(false));

    return (
        <LegendItemContainer>
            <LegendDot
                fill={color}
                stroke={color}
                onClick={() => setPickerOpen(true)}
            />
            {label}
            <Popover ref={containerRef} open={pickerOpen}>
                <ColorPicker color={color} updateColor={updateColor} />
            </Popover>
        </LegendItemContainer>
    );
};

const PickerInput = styled(Input)`
    width: 95%;
`;

interface ColorPickerProps {
    color: string;
    updateColor: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ color, updateColor }) => {
    return (
        <Column>
            <HexColorPicker color={color} onChange={updateColor} />
            <PickerInput
                value={color}
                onChange={e => updateColor(e.currentTarget.value)}
            />
        </Column>
    );
};

const LegendItemContainer = styled.span`
    align-items: center;
    display: flex;
    position: relative;
`;

const Popover = styled.div<{ open: boolean }>`
    background-color: ${props => props.theme.palette.white};
    display: ${props => (props.open ? 'flex' : 'none')};
    position: absolute;
    bottom: 15px;
    left: 0;
`;

export default Legend;
