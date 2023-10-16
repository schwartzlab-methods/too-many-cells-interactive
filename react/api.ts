import { FeatureMap } from './src/types';

export const fetchFeatureNames = async (searchTerm: string) => {
    const res = await fetch(`/api/feature-names?q=${searchTerm}`);
    const features = (await res.json()) as string[];
    return features;
};

export const fetchFeatures = async (q: string) => {
    const res = await fetch(`/api/features?q=${q}`);
    return res.json() as Promise<FeatureMap>;
};
