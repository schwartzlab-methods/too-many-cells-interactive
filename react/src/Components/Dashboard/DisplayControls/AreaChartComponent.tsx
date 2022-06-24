import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Text } from '../../Typography';
import { AreaChart } from '../../../Visualizations';

interface AreaChartComponentProps {
    counts: Record<number, number>;
    onBrush: (val: number) => void;
    title?: string;
    value?: number;
    xLabel: string;
}

const AreaChartComponent: React.FC<AreaChartComponentProps> = ({
    counts,
    onBrush,
    title,
    value,
    xLabel,
}) => {
    const [Chart, setChart] = useState<AreaChart>();
    const selector = useRef<string>(`a${Math.random().toString(36).slice(3)}`);

    useEffect(() => {
        /* 
            D3 isn't part of react ecosystem and doesn't know when the callback has been updated with new context 
            so we have to update the callback manually
        */
        if (Chart) {
            Chart.onBrush = onBrush;
        }
    }, [onBrush]);

    useLayoutEffect(() => {
        const Chart = new AreaChart(
            counts,
            onBrush,
            `.${selector.current}`,
            xLabel,
            title
        );
        setChart(Chart);
        Chart.render(value);
    }, []);

    useEffect(() => {
        if (Chart) {
            Chart.counts = counts;
            Chart.render(value);
        }
    }, [counts, value]);

    return Object.values(counts).length < 3 ? (
        <ErrorContainer>
            <Text>
                This filter is incompatible with the current distribution of
                nodes.
            </Text>
        </ErrorContainer>
    ) : (
        <div className={selector.current} style={{ width: '100%' }} />
    );
};

const ErrorContainer = styled.div`
    padding: 10px;
`;

export default AreaChartComponent;
