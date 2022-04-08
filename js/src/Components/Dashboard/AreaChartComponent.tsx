import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AreaChart } from './../../Visualizations';

interface AreaChartComponentProps {
    counts: Map<number, number>;
    onBrush: (val: number) => void;
    title?: string;
    xLabel: string;
}

const AreaChartComponent: React.FC<AreaChartComponentProps> = ({
    counts,
    onBrush,
    title,
    xLabel,
}) => {
    const [chart, setChart] = useState<AreaChart>();
    const selector = useRef<string>(`a${Math.random().toString(36).slice(3)}`);

    useEffect(() => {
        /* 
            D3 isn't part of react ecosystem and doesn't know when the callback has been updated with new context 
            so we have to update the callback manually
        */
        if (chart) {
            chart.onBrush = onBrush;
        }
    }, [onBrush]);

    useLayoutEffect(() => {
        const chart = new AreaChart(
            counts,
            onBrush,
            `.${selector.current}`,
            xLabel,
            title
        );
        setChart(chart);
        chart.render();
    }, []);

    return <div className={selector.current} style={{ width: '100%' }} />;
};

export default AreaChartComponent;
