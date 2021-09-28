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

console.time('\tLoading records')
const slnbRecords = JSON.parse(
	fs.readFileSync(slnbPath).toString()
) as PatientRecord[]
const elndRecords = JSON.parse(
	fs.readFileSync(elndPath).toString()
) as PatientRecord[]
console.timeEnd('\tLoading records')

console.time('\tComparing & sorting cases')

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

const getConflicts = () =>
	pairings.filter(
		({ elndRecord }) =>
			pairings.filter(
				(comparison) => comparison.elndRecord.id === elndRecord.id
			).length > 1
	)

let conflicts: RecordComparison[] = getConflicts()

// Transposes a 2D array
const transpose = (array: any[][]): any[][] =>
	array[0].map((_, colIndex) => array.map((row) => row[colIndex]))

const sumDifferences = (arr: RecordComparison[]): number =>
	arr.reduce<number>((sum, comparison) => sum + comparison.difference, 0)

/**
 * A recursive conflict resolver that optimises for the minimum `difference` across N records.
 * An array of ranked-match arrays is min-maxed to produce an optimal 1D array of matches.
 *
 * @param data: A decision tree. A 2D array of the following shape:
 * [
 *  [SLNB1 1st ranked choice, SLNB1 2nd ranked choice, SLNB1 3rd ranked choice, ...],
 *  [SLNB2 1st ranked choice, SLNB2 2nd ranked choice, SLNB2 3rd ranked choice, ...],
 *  [SLNB3 1st ranked choice, SLNB3 2nd ranked choice, SLNB3 3rd ranked choice, ...],
 * ]
 * @returns An optimal set of pairings given the input tree.
 * For example, the optimal set of pairings may be as follows:
 * [
 *  SLNB3 1st choice,
 *  SLNB1 2nd choice,
 *  SLNB2 3rd choice
 * ]
 * Where each 'choice' is a pairing with an ELND record.
 * The set of pairings produced has the lowest summed `difference` value of all permutations.
 */
const resolveConflict = (data: RecordComparison[][]): RecordComparison[] => {
	// Base case - if there's only 1 match left then there is no decision to make.
	if (data.length === 1) {
		return data[0]
	}

	// Otherwise, we need to consider N branches, recursing through each
	return data[0]
		.map((comparison, index) => {
			const slicedData = data
				.slice(1)
				.map((options) => [
					...options.slice(0, index),
					...options.slice(index + 1),
				])
			const recursedValue = resolveConflict(slicedData)
			return [comparison, ...recursedValue]
		})
		.reduce<RecordComparison[]>((lowest, current) => {
			return !lowest.length || sumDifferences(lowest) > sumDifferences(current)
				? current
				: lowest
		}, [])
}

/**
 *
 * @param comparison The pairing between an SLNB and ELND record.
 * This pairing may be an optimal pairing between an SLNB and ELND record, or some Nth best option.
 * @param n A limit for the number of ranked matches to return.
 * @returns an array of ranked matches according to `difference` value.
 * For example:
 * If the comparison given happens to be SLNB1's 3rd best ranked match, then
 *  this function will return the 3rd, 4th, 5th... Nth next best matches.
 */
const getNextRankedMatches = (
	comparison: RecordComparison,
	n?: number
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
		({ elndRecord: { id } }) => id === comparison.elndRecord.id
	)

	// Return the rankMatches from this record down.
	// (If `n` is defined, return the next `n` pairings, otherwise return all subsequent pairings)
	return rankedMatches.slice(
		comparisonIndex,
		n ? comparisonIndex + n : undefined
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

	// For each pairing, find the next best pairings.
	// We can trim the tree in the Y direction to `band.length` (ie make it square)
	// This is because we only need the next N best pairings for a conflict of size N.
	const resolutionTree = band.map((comparison) =>
		getNextRankedMatches(comparison, band.length)
	)

	const resolved = resolveConflict(transpose(resolutionTree))

	// Remove the conflict from pairings
	pairings = pairings.filter(({ elndRecord: { id } }) => id !== elndId)

	// Add our resolution back into pairings
	pairings = pairings.concat(resolved)

	console.timeEnd(`\tSolving ${band.length} conflicts with ELND:${elndId}`)

	// Reset conflict list (we've removed some conflicts but may have introduced more).
	conflicts = getConflicts()

	console.log(`\t${conflicts.length} conflicts left to resolve...`)

	// Handle any infinite loops with a limiter
	iterationCounter += 1
	if (iterationCounter > 30) {
		console.error('Exceeded max iteration count: 30')
		break
	}
}
console.timeEnd('\tFinding optimal pairings')

console.log(
	'Matches: ',
	pairings.map(comparisonToString),
	`(${pairings.length})`
)

console.time(`\tDumping pairings to ${pairingJsonPath}`)
fs.writeFileSync(pairingJsonPath, JSON.stringify(pairings))
console.timeEnd(`\tDumping pairings to ${pairingJsonPath}`)

const perfectMatches = pairings.filter(({ perfect }) => perfect).length
const imperfectMatches = pairings.length - perfectMatches
console.log(
	`${perfectMatches} perfect matches, ${imperfectMatches} imperfect matches`
)

const pairingLoss = pairings.reduce(
	(sum, { difference }) => sum + difference,
	0
)
console.log(`Total Hazard difference: ${pairingLoss.toFixed(3)}`)

console.log('Done ✅')
