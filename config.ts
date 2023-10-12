// Input/output file paths
export const CSV_PATH = './data/input/dataset.csv';
export const SLNB_PATH = './data/input/slnb.json';
export const ELND_PATH = './data/input/elnd.json';
export const PAIRING_JSON_PATH = './data/output/pairings.json';
export const PAIRING_CSV_PATH = './data/output/pairings.csv';

/**
 * The histopathological variables in the order that they appear in the input file
 */
export const VARIABLES = [
  'depthCode',
  'dysplasia',
  'perineural',
  'lvi',
  'invasiveFrontType',
  'ene',
] as const;

export type VariableName = (typeof VARIABLES)[number];

export const COLUMN_HEADERS = [
  'Gender Code',
  'Date of Surgery',

  // The following must exactly match the order of variables defined above
  'Depth Code',
  'Dysplasia Present',
  'Perineural',
  'LVI',
  'Invasive Front Type',
  'ENE',

  'SLNB',
  'ELND',
] as const;

/**
 * Manually disable matching for a given variable
 * The variable will be assigned to null in the matching and output
 */
export const DISABLED_VARIABLES: Record<VariableName, boolean> = {
  depthCode: false,
  dysplasia: false,
  perineural: false,
  lvi: false,
  invasiveFrontType: false,
  ene: false,
} as const;

/**
 * Defines the hazard ratios associated with given input values
 * If no hazard ratio is provided for an input value, it defaults to 0
 */
export const HAZARD_RATIOS: Record<VariableName, Record<number, number>> = {
  depthCode: {
    3: 2.6,
    2: 2.1,
  },
  dysplasia: {
    0: 1.6,
  },
  invasiveFrontType: {
    2: 1.6,
  },
  lvi: {
    1: 1.6,
  },
  perineural: {
    1: 1.5,
  },
  ene: {
    1: 1.4,
  },
} as const;

/**
 * The maximum number of missing values a record can have before being discarded
 */
export const MISSING_VALUE_THRESHOLD = 1;
