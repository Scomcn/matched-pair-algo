#!/usr/bin/env ts-node

import { HAZARD_RATIOS } from '../config';
import type { VariableName } from '../config';

export type PatientRecord = {
  id: number;
  genderCode: number;
  surgeryDate: Date;
  variables: Record<VariableName, number | null>;
  surgeryType: 'SLNB' | 'ELND';
  discard?: boolean; // Don't use this record for pairings
};

export type RecordComparison = {
  slnbRecord: PatientRecord;
  elndRecord: PatientRecord;
  slnbHazard: number;
  elndHazard: number;
  difference: number;
  perfect?: boolean;
  explanation?: string;
  toString?: () => string;
};

const variablesToHazardRatios = ({ variables }: PatientRecord) =>
  Object.entries(variables).map(
    ([variable, value]) =>
      HAZARD_RATIOS[variable as VariableName][value ?? -1] ?? 0,
  );

/**
 * Calculates the hazard ratio associated with the given patient record
 * @param record Patient record containing histopatholigical variables
 * @returns Hazard ratio calculated from variables in patient record
 */
export const getHazard = (record: PatientRecord) =>
  variablesToHazardRatios(record).reduce((current, sum) => (sum += current));

/**
 * Shows calculation for the hazard ratio associated with the given patient record
 * @param record Patient record containing histopatholigical variables
 * @returns String representing the hazard ratio calculation for the given patient record
 */
export const getHazardExplanation = (record: PatientRecord): string =>
  `${variablesToHazardRatios(record)
    .map((v) => v.toFixed(1))
    .join('+')}=${getHazard(record).toFixed(1)}`;

/**
 * Check if variables in both records are identical
 * @param slnbRecord Patient record from SLNB list
 * @param elndRecord Patient record from ELND list
 * @returns True if each variable in SLNB record is exactly the same as ELND record
 */
export const isPerfectMatch = (
  slnbRecord: PatientRecord,
  elndRecord: PatientRecord,
): boolean =>
  Object.entries(slnbRecord.variables).every(
    ([variable, value]) =>
      elndRecord.variables[variable as VariableName] === value,
  );

/**
 * Stringifies a record comparison for pretty-printing
 * @param comparison The record comparison object to pretty-print
 * @returns Pretty-printed string of the record comparison
 */
export const comparisonToString = ({
  slnbRecord,
  elndRecord,
  slnbHazard,
  elndHazard,
  difference,
  perfect = false,
}: RecordComparison): string =>
  `SLNB:${slnbRecord.id}<->ELND:${
    elndRecord.id
  } Hazard ratios: ${slnbHazard.toFixed(1)}/${elndHazard.toFixed(
    1,
  )} Diff=${difference.toFixed(1)} ${perfect ? '(perfect)' : ''}`;
