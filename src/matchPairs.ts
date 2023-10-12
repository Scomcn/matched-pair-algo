#!/usr/bin/env ts-node

import fs from 'fs';

import { ELND_PATH, PAIRING_JSON_PATH, SLNB_PATH } from '../config';
import {
  PatientRecord,
  RecordComparison,
  comparisonToString,
  getHazard,
  isPerfectMatch,
} from './util';

console.time('\tLoading records');
const slnbRecords = JSON.parse(
  fs.readFileSync(SLNB_PATH).toString(),
) as PatientRecord[];
const elndRecords = JSON.parse(
  fs.readFileSync(ELND_PATH).toString(),
) as PatientRecord[];
console.timeEnd('\tLoading records');

console.time('\tComparing & sorting cases');

// Produces a list of pairings where each SLNB record is paired with its closest matching ELND record
// Note: This list of pairings will not be unique - the same records may be reused
export const getRankedPairings = (
  slnbRecord: PatientRecord,
  elndRecords: PatientRecord[],
  maxLength?: number,
): RecordComparison[] =>
  elndRecords
    .filter((record) => !record.discard) // Don't pair any records marked as discard
    .map((elndRecord) => {
      const slnbHazard = getHazard(slnbRecord);
      const elndHazard = getHazard(elndRecord);
      const difference = Math.abs(elndHazard - slnbHazard);
      const perfect = isPerfectMatch(slnbRecord, elndRecord);
      return {
        slnbRecord,
        elndRecord,
        slnbHazard,
        elndHazard,
        difference,
        perfect,
        toString: () =>
          comparisonToString({
            slnbRecord,
            slnbHazard,
            elndRecord,
            elndHazard,
            difference,
            perfect,
          }),
      };
    })
    .sort((a, b) => {
      // If cases have same hazard ratio, prioritise cases with identical factors.
      const diff = a.difference - b.difference;
      return diff === 0 ? Number(b.perfect) - Number(a.perfect) : diff;
    })
    // Optimisation - if we have 50 total SLNB records we only need a ranked list of top 50 ELND records
    // because worst case is that the other 49 SLNB records are paired with the same top 49 ranked ELND records.
    // Therefore (with 50 SLNB records) there's no case where we need the 51st ELND record match.
    .slice(0, maxLength);

const rankedPairings: RecordComparison[][] = slnbRecords
  .filter((record) => !record.discard) // Don't pair any records marked as discard
  .map((slnbRecord) =>
    getRankedPairings(slnbRecord, elndRecords, slnbRecords.length),
  );
console.timeEnd('\tComparing & sorting cases');

console.time('\tFinding optimal pairings');
let pairings = rankedPairings.map((comparisons) => comparisons[0]);

// Detect pairings where two SLNB records are reusing the same ELND record
const getConflicts = (pairingList: RecordComparison[]) =>
  pairingList.filter(
    ({ elndRecord }) =>
      pairings.filter(
        (comparison) => comparison.elndRecord.id === elndRecord.id,
      ).length > 1,
  );

/**
 * For an array of pairings, calculate the cumulative hazard ratio difference
 * @param pairings The list pairings on which the calculation will be performed
 * @returns A number representing the summed difference of hazard ratios
 */
const sumHazardDifferences = (pairings: RecordComparison[]): number =>
  pairings.reduce<number>((sum, comparison) => sum + comparison.difference, 0);

/**
 * Given a band of pairings that use the same ELND record, finds the best combination of pairings to resolve this conflict
 * Note: if the next-top pairings for the other records are also conflicts, this isn't handled here; only one is resolved
 * @param conflicts An array of conflicting pairings
 * @returns A new list of pairings where at least 1 conflict has been resolved.
 */
const resolveSingleConflict = (
  conflictBand: RecordComparison[],
): RecordComparison[] =>
  conflictBand
    // Create a combination where this pairing gets its top match, others get next-top
    .map((pairing, index) => [
      ...conflictBand.slice(0, index).map(getNextRankedMatch),
      pairing,
      ...conflictBand.slice(index + 1).map(getNextRankedMatch),
    ])
    // Select the set of pairings with the lowest cumulative difference in hazard ratios
    .reduce(
      (
        candidateResolution: RecordComparison[],
        currentResolution: RecordComparison[],
      ) =>
        !candidateResolution ||
        sumHazardDifferences(currentResolution) <
          sumHazardDifferences(candidateResolution)
          ? currentResolution
          : candidateResolution,
    );

/**
 *
 * @param comparison The pairing between an SLNB and ELND record.
 * This pairing may be an optimal pairing between an SLNB and ELND record, or some Nth best option.
 * @param limit A limit for the number of ranked matches to return.
 * @returns an array of ranked matches according to `difference` value.
 * For example:
 * If the comparison given happens to be SLNB1's 3rd best ranked match, then
 *  this function will return the 4th, 5th, 6th... Nth next best matches.
 */
const getNextRankedMatches = (
  comparison: RecordComparison,
  limit?: number,
): RecordComparison[] => {
  // Find the rankedMatches for the SLNB record in question
  const rankedMatches =
    rankedPairings.find(
      (sortedComparisonsById) =>
        sortedComparisonsById[0].slnbRecord.id === comparison.slnbRecord.id,
    ) ?? [];

  // The comparison may be the 2nd, 3rd, 4th... match in the rankings
  // So we need to find the index in rankedMatches that this comparison refers to.
  const comparisonIndex = rankedMatches.findIndex(
    ({ elndRecord }) => elndRecord.id === comparison.elndRecord.id,
  );

  // Return the rankedMatches from this record down.
  // (If `limit` is defined, return that number of pairings, otherwise return all subsequent pairings)
  return rankedMatches.slice(
    comparisonIndex + 1,
    limit && comparisonIndex + 1 + limit,
  );
};

const getNextRankedMatch = (comparison: RecordComparison) =>
  getNextRankedMatches(comparison, 1)[0];

let conflicts: RecordComparison[] = getConflicts(pairings);

while (conflicts.length) {
  // Take the first conflicting ELND ID
  const elndId = conflicts[0].elndRecord.id;

  // Find all other pairings to this ELND ID by other SLNB records.
  const band = conflicts.filter(({ elndRecord }) => elndRecord.id === elndId);

  console.time(`\tSolving ${band.length} conflicts with ELND:${elndId}`);

  const resolved = resolveSingleConflict(band);

  // Remove the conflict from pairings
  pairings = pairings.filter(({ elndRecord: { id } }) => id !== elndId);

  // Add our resolution back into pairings
  pairings = pairings.concat(resolved);

  console.timeEnd(`\tSolving ${band.length} conflicts with ELND:${elndId}`);

  // Reset conflict list (we've removed some conflicts but may have introduced more).
  conflicts = getConflicts(pairings);
}

console.timeEnd('\tFinding optimal pairings');

console.log(
  'Matches: ',
  pairings
    .sort((p1, p2) => p1.slnbRecord.id - p2.slnbRecord.id)
    .map(comparisonToString),
  `(${pairings.length})`,
);

console.time(`\tDumping pairings to ${PAIRING_JSON_PATH}`);
fs.writeFileSync(PAIRING_JSON_PATH, JSON.stringify(pairings));
console.timeEnd(`\tDumping pairings to ${PAIRING_JSON_PATH}`);

const perfectMatches = pairings.filter(({ perfect }) => !!perfect).length;
const imperfectMatches = pairings.length - perfectMatches;
console.log(
  `${perfectMatches} perfect matches, ${imperfectMatches} imperfect matches`,
);

const totalHazardDifference = sumHazardDifferences(pairings);
console.log(`Total Hazard difference: ${totalHazardDifference.toFixed(3)}`);

console.log('Done ✅');
