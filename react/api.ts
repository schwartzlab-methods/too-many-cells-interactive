export const fetchFeatureNames = async () => {
    const res = await fetch('/api/features-set');
    const js = (await res.json()) as string[];
    //todo: this should all be handled by the db
    return js.map(d => d.toLowerCase()).sort((a, b) => (a < b ? -1 : 1));
};

interface Feature {
    feature: string;
    feature_type: string;
    id: string;
    value: number;
}

export const fetchFeatures = async (q: string) => {
    const res = await fetch(`/api/features?q=${q}`);
    const js = (await res.json()) as Feature[];
    return js;
};
