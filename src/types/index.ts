export interface Demographics {
  age: string;
  gender: string;
  income: string;
  region: string;
  ethnicity: string;
}

export interface PersonaResult {
  personaId: number;
  demographics: Demographics;
  rawResponse: string;
  likertDistribution: number[];
  meanPI: number;
}

export interface AnalysisRequest {
  concept: string;
  demographics: Demographics[];
  personaCount: number;
  apiKey: string;
}

export interface AnalysisResponse {
  personas: PersonaResult[];
  overallMeanPI: number;
  distributionAggregated: number[];
  qualitativeFeedback: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
}

export const AGE_OPTIONS = [
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
];

export const GENDER_OPTIONS = ["Male", "Female", "Non-binary"];

export const INCOME_OPTIONS = [
  "Under $25k",
  "$25k-$50k",
  "$50k-$75k",
  "$75k-$100k",
  "$100k-$150k",
  "$150k+",
];

export const REGION_OPTIONS = [
  "Northeast US",
  "Southeast US",
  "Midwest US",
  "Southwest US",
  "West Coast US",
  "Pacific Northwest US",
  "Western Europe",
  "Eastern Europe",
  "East Asia",
  "South Asia",
  "Southeast Asia",
  "Latin America",
  "Middle East",
  "Sub-Saharan Africa",
  "Oceania",
];

export const ETHNICITY_OPTIONS = [
  "White/Caucasian",
  "Black/African American",
  "Hispanic/Latino",
  "Asian",
  "Native American",
  "Pacific Islander",
  "Middle Eastern",
  "Mixed/Multiracial",
  "Other",
];
