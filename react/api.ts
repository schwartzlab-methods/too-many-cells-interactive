import { FeatureMap } from './src/types';

export const fetchFeatureNames = async () => {
    const res = await fetch('/api/features-set');
    const features = (await res.json()) as string[];
    return features.sort((a, b) => (a < b ? -1 : 1));
};

export const fetchFeatures = async (q: string) => {
    const res = await fetch(`/api/features?q=${q}`);
    return res.json() as Promise<FeatureMap>;
};
