#!/usr/bin/env ts-node

import fs from 'fs';
import { getHazardExplanation, PatientRecord, RecordComparison } from './util';
import {
  COLUMN_HEADERS,
  ELND_PATH,
  PAIRING_CSV_PATH,
  PAIRING_JSON_PATH,
  SLNB_PATH,
} from '../config';

console.time(`\tReading pairings from "${PAIRING_JSON_PATH}"`);

const slnbRecords = JSON.parse(
  fs.readFileSync(SLNB_PATH).toString(),
) as PatientRecord[];

const elndRecords = JSON.parse(
  fs.readFileSync(ELND_PATH).toString(),
) as PatientRecord[];

const pairings = JSON.parse(
  fs.readFileSync(PAIRING_JSON_PATH).toString(),
) as RecordComparison[];

console.timeEnd(`\tReading pairings from "${PAIRING_JSON_PATH}"`);

console.time('\tConverting pairings to CSV rows');

const csvHeader = [
  ...COLUMN_HEADERS,
  'Hazard calculation',
  'Discarded',
  'Paired with',
  'Hazard difference',
  'Perfect match',
].join(',');

const allRecords = [...slnbRecords, ...elndRecords].sort((a, b) => a.id - b.id);

const csvRows = allRecords.map((record) => {
  const variables = Object.values(record.variables).map(
    (v) => v?.toFixed(1) ?? '',
  );

  const row = [
    record.genderCode,
    record.surgeryDate.toString(),
    ...variables,
    Number(record.surgeryType === 'SLNB'),
    Number(record.surgeryType === 'ELND'),
    getHazardExplanation(record),
    Number(record.discard),
  ];

  // If this record has been paired with another, find that record
  const pairing = pairings.find(
    ({ slnbRecord, elndRecord }) =>
      slnbRecord.id === record.id || elndRecord.id === record.id,
  );

  if (pairing) {
    // Get the ID of the record this record is paired with
    const pairingId =
      record.surgeryType === 'SLNB'
        ? pairing?.elndRecord.id
        : pairing?.slnbRecord.id;

    row.push(pairingId);
    row.push(pairing.difference.toFixed(1));
    row.push(pairing.perfect ? 1 : 0);
  }

  return row.join(',');
});

const pairingsCsvData = [csvHeader, ...csvRows].join('\r\n');

console.timeEnd('\tConverting pairings to CSV rows');

console.time(`\tWriting CSV rows to "${PAIRING_CSV_PATH}"`);
fs.writeFileSync(PAIRING_CSV_PATH, pairingsCsvData);
console.timeEnd(`\tWriting CSV rows to "${PAIRING_CSV_PATH}"`);

console.log(`${csvRows.length} rows, ${pairings.length} pairings`);
console.log('Done ✅');
