#!/usr/bin/env ts-node

import fs from 'fs'

import {
	PatientRecord,
	RecordComparison,
	pairingJsonPath,
	elndPath,
	slnbPath,
	getHazard,
	isPerfectMatch,
	comparisonToString,
} from './common'

const MAX_ITERATION_LIMIT = 30

console.time('\tLoading records')
const slnbRecords = JSON.parse(
	fs.readFileSync(slnbPath).toString()
) as PatientRecord[]
const elndRecords = JSON.parse(
	fs.readFileSync(elndPath).toString()
) as PatientRecord[]
console.timeEnd('\tLoading records')

console.time('\tComparing & sorting cases')

// Produces a list of pairings where each SLNB record is paired with its closest matching ELND record
// Note: This list of pairings will not be unique - the same records may be reused
export const getRankedPairings = (
	slnbRecord: PatientRecord,
	elndRecords: PatientRecord[]
): RecordComparison[] =>
	elndRecords
		.map((elndRecord) => {
			const slnbHazard = getHazard(slnbRecord)
			const elndHazard = getHazard(elndRecord)
			const difference = Math.abs(elndHazard - slnbHazard)
			const perfect = isPerfectMatch(slnbRecord, elndRecord)
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
			}
		})
		.sort((a, b) => {
			// If cases have same hazard ratio, prioritise cases with identical factors.
			const accuracyDiff = a.difference - b.difference
			return accuracyDiff === 0
				? Number(b.perfect) - Number(a.perfect)
				: accuracyDiff
		})

const rankedPairings: RecordComparison[][] = slnbRecords.map((slnbRecord) =>
	getRankedPairings(slnbRecord, elndRecords)
)
console.timeEnd('\tComparing & sorting cases')

console.time('\tFinding optimal pairings')
let pairings = rankedPairings.map((comparisons) => comparisons[0])

// Detect pairings where two SLNB records are reusing the same ELND record
const getConflicts = (pairingList: RecordComparison[]) =>
	pairingList.filter(
		({ elndRecord }) =>
			pairings.filter(
				(comparison) => comparison.elndRecord.id === elndRecord.id
			).length > 1
	)

let conflicts: RecordComparison[] = getConflicts(pairings)

/**
 * For an array of pairings, calculate the cumulative hazard ratio difference
 * @param pairings The list pairings on which the calculation will be performed
 * @returns A number representing the summed difference of hazard ratios
 */
const sumDifferences = (pairings: RecordComparison[]): number =>
	pairings.reduce<number>((sum, comparison) => sum + comparison.difference, 0)

/**
 * Given an array of conflicting pairings, find the combination of pairings with the lowest cumulative hazard ratio difference
 * @param conflicts An array of conflicting pairings
 * @returns A new list of pairings that has no conflicts and the lowest difference of hazard ratios of all pairing combinations.
 */
const resolveConflict = (conflicts: RecordComparison[]): RecordComparison[] => {
	// Base case - if there's only 1 match left then there is no decision to make.
	if (conflicts.length === 1) {
		return conflicts
	}

	const resolved = conflicts
		.map((pairing, index) => {
			// For each pairing, keep its default best match and try assigning the other conflicts their next closest.
			const otherConflicts = [
				...conflicts.slice(0, index),
				...conflicts.slice(index + 1),
			]

			// Get the next-best match for each conflict
			let nextBestMatches = otherConflicts.map(
				// The [0] index is the current match. [1] is the next-best match.
				(conflict) => getNextRankedMatches(conflict)[1]
			)

			// If the nextBestMatches also happen to have conflicts, solve those too.
			// This will give us the most optimal set of alternative pairings.
			if (getConflicts(nextBestMatches)) {
				resolveConflict(nextBestMatches)
			}

			// Now we have a non-conflicting list of next-best matches, return it since it's a potential option.
			return [pairing, ...nextBestMatches]
		})
		.reduce(
			(
				candidateResolution: RecordComparison[],
				currentResolution: RecordComparison[]
			) => {
				// In this step, we consider every possible combination of matches.
				// We select the match with the lowest cumulative hazard ratio difference.
				if (
					candidateResolution === undefined ||
					sumDifferences(currentResolution) <
						sumDifferences(candidateResolution)
				) {
					return currentResolution
				} else {
					return candidateResolution
				}
			}
		)

	return resolved
}

/**
 *
 * @param comparison The pairing between an SLNB and ELND record.
 * This pairing may be an optimal pairing between an SLNB and ELND record, or some Nth best option.
 * @param limit A limit for the number of ranked matches to return.
 * @returns an array of ranked matches according to `difference` value.
 * For example:
 * If the comparison given happens to be SLNB1's 3rd best ranked match, then
 *  this function will return the 3rd, 4th, 5th... Nth next best matches.
 */
const getNextRankedMatches = (
	comparison: RecordComparison,
	limit?: number
): RecordComparison[] => {
	// Find the rankedMatches for the SLNB record in question
	const rankedMatches =
		rankedPairings.find(
			(sortedComparisonsById) =>
				sortedComparisonsById[0].slnbRecord.id === comparison.slnbRecord.id
		) ?? []

	// The comparison may be the 2nd, 3rd, 4th... match in the rankings
	// So we need to find the index in rankedMatches that this comparison refers to.
	const comparisonIndex = rankedMatches.findIndex(
		({ elndRecord }) => elndRecord.id === comparison.elndRecord.id
	)

	// Return the rankedMatches from this record down.
	// (If `limit` is defined, return that number of pairings, otherwise return all subsequent pairings)
	return rankedMatches.slice(
		comparisonIndex,
		limit ? comparisonIndex + limit : undefined
	)
}

// Keeps track of the number of iterations of the below `while` clause. Prevents infinite loop.
let iterationCounter = 0

// Iterate over the list of pairings as long as conflicts exist.
while (conflicts.length) {
	// Take the first conflicting ELND ID
	const elndId = conflicts[0].elndRecord.id

	// Find all other pairings to this ELND ID by other SLNB records.
	const band = conflicts.filter(({ elndRecord }) => elndRecord.id === elndId)

	console.time(`\tSolving ${band.length} conflicts with ELND:${elndId}`)

	const resolved = resolveConflict(band)

	// Remove the conflict from pairings
	pairings = pairings.filter(({ elndRecord: { id } }) => id !== elndId)

	// Add our resolution back into pairings
	pairings = pairings.concat(resolved)

	console.timeEnd(`\tSolving ${band.length} conflicts with ELND:${elndId}`)

	// Reset conflict list (we've removed some conflicts but may have introduced more).
	conflicts = getConflicts(pairings)

	console.log(`\t${conflicts.length} conflicts left to resolve...`)

	// Handle any infinite loops with a limiter
	iterationCounter += 1
	if (iterationCounter > MAX_ITERATION_LIMIT) {
		console.error(`Exceeded max iteration count: ${MAX_ITERATION_LIMIT}`)
		break
	}
}
console.timeEnd('\tFinding optimal pairings')

console.log(
	'Matches: ',
	pairings
		.sort((p1, p2) => p1.slnbRecord.id - p2.slnbRecord.id)
		.map(comparisonToString),
	`(${pairings.length})`
)

console.time(`\tDumping pairings to ${pairingJsonPath}`)
fs.writeFileSync(pairingJsonPath, JSON.stringify(pairings))
console.timeEnd(`\tDumping pairings to ${pairingJsonPath}`)

const perfectMatches = pairings.filter(({ perfect }) => !!perfect).length
const imperfectMatches = pairings.length - perfectMatches
console.log(
	`${perfectMatches} perfect matches, ${imperfectMatches} imperfect matches`
)

const totalHazardDifference = sumDifferences(pairings)
console.log(`Total Hazard difference: ${totalHazardDifference.toFixed(3)}`)

console.log('Done ✅')
