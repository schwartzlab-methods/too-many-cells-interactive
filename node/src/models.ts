import mongoose from 'mongoose';

export interface FeatureType {
    feature: string;
    feature_type: string;
    ide: string;
    value: number;
}

const featureModel = {
    feature: String,
    feature_type: String,
    id: String,
    value: Number,
};

const featureSchema = new mongoose.Schema<FeatureType>(featureModel);

export const Feature = mongoose.model('features', featureSchema, 'features');
