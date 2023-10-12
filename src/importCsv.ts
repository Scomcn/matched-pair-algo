#!/usr/bin/env ts-node

import fs from 'fs';

import {
  DISABLED_VARIABLES,
  MISSING_VALUE_THRESHOLD,
  VARIABLES,
  VariableName,
  CSV_PATH,
  ELND_PATH,
  SLNB_PATH,
} from '../config';

import { PatientRecord } from './util';

console.time(`\tReading unpaired records from "${CSV_PATH}"`);
const csv = fs.readFileSync(CSV_PATH).toString();

// Use `slice` to remove first line - it contains the headers
const csvLines = csv
  .split('\n')
  // Remove any carriage return characters
  .map((line) => line.replace(/\r/, ''))
  .slice(1);
console.timeEnd(`\tReading unpaired records from "${CSV_PATH}"`);

console.time(`\tParsing SLNB and ELND records from CSV rows`);
const slnbRecords: PatientRecord[] = [];
const elndRecords: PatientRecord[] = [];

csvLines.forEach((rowString, index) => {
  const columns = rowString.split(',');

  const numMissingValues = columns.filter((v) => v === '').length;

  const genderCode = Number.parseInt(columns[0]);
  const surgeryDate = new Date(columns[1]);

  const variableValues = columns
    .slice(2, -2)
    .map((v) => (v ? Number.parseInt(v) : null));

  const variables = Object.fromEntries(
    VARIABLES.map((variable, i) => {
      const value = DISABLED_VARIABLES[variable] ? null : variableValues[i];
      return [variable, value];
    }),
  ) as Record<VariableName, number | null>;

  const [slnb, elnd] = columns.slice(-2).map((v) => Number.parseInt(v));

  const row: PatientRecord = {
    id: index + 2, // Offset of 2 since we trimmed off the headers, and because Excel rows start at 1 not 0.
    genderCode,
    surgeryDate,
    variables,
    surgeryType: slnb ? 'SLNB' : 'ELND',
    discard: numMissingValues > MISSING_VALUE_THRESHOLD,
  };

  if (slnb) {
    slnbRecords.push(row);
  } else if (elnd) {
    elndRecords.push(row);
  }
});
console.timeEnd(`\tParsing SLNB and ELND records from CSV rows`);

console.time(
  `\tWriting SLNB and ELND records to "${SLNB_PATH}" and "${ELND_PATH}"`,
);
fs.writeFileSync(SLNB_PATH, JSON.stringify(slnbRecords));
fs.writeFileSync(ELND_PATH, JSON.stringify(elndRecords));
console.timeEnd(
  `\tWriting SLNB and ELND records to "${SLNB_PATH}" and "${ELND_PATH}"`,
);

const totalRecords = slnbRecords.length + elndRecords.length;
const discardedRecords = csvLines.length - totalRecords;

console.log(
  `${totalRecords} records imported (${discardedRecords} records discarded) -`,
  `${slnbRecords.length} SLNB records, ${elndRecords.length} ELND records.`,
);
console.log('Done ✅');
