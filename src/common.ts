// This file contains definitions of constants used across multiple ts files
export const csvPath = './data/input/dataset.csv'
export const slnbPath = './data/input/slnb.json'
export const elndPath = './data/input/elnd.json'
export const pairingJsonPath = './data/output/pairings.json'
export const pairingCsvPath = './data/output/pairings.csv'

export type PatientRecord = {
	id: number
	genderCode: number
	surgeryDate: Date
	depthCode: number
	dysplasia: boolean
	invasiveCode: number
	perineural: boolean
	ene: boolean
	lvi: boolean
}

export type RecordComparison = {
	slnbRecord: PatientRecord
	elndRecord: PatientRecord
	slnbHazard: number
	elndHazard: number
	difference: number
	perfect?: boolean
	explanation?: string
	toString?: () => string
}

export const HAZARD_RATIOS = {
	DYSPLASIA: 2,
	INVASIVE_CODE: 2,
	DEPTH_CODE: 1.8,
	ENE: 1.4,
	PERINEURAL: 1.4,
	LVI: 1.3,
} as const

const isDysplasiaHazard = (dysplasiaValue: boolean) => !dysplasiaValue
const isInvasiveCodeHazard = (invasiveCodeValue: number) =>
	invasiveCodeValue > 1
const isDepthCodeHazard = (depthCodeValue: number) => depthCodeValue > 1
const isEneHazard = (eneValue: boolean) => eneValue
const isPerineuralHazard = (perineuralValue: boolean) => perineuralValue
const isLviHazard = (lviValue: boolean) => lviValue

export const getHazard = ({
	dysplasia,
	invasiveCode,
	depthCode,
	ene,
	perineural,
	lvi,
}: PatientRecord): number =>
	(isDysplasiaHazard(dysplasia) ? HAZARD_RATIOS.DYSPLASIA : 0) +
	(isInvasiveCodeHazard(invasiveCode) ? HAZARD_RATIOS.INVASIVE_CODE : 0) +
	(isDepthCodeHazard(depthCode) ? HAZARD_RATIOS.DEPTH_CODE : 0) +
	(isEneHazard(ene) ? HAZARD_RATIOS.ENE : 0) +
	(isPerineuralHazard(perineural) ? HAZARD_RATIOS.PERINEURAL : 0) +
	(isLviHazard(lvi) ? HAZARD_RATIOS.LVI : 0)

export const getHazardExplanation = ({
	dysplasia,
	invasiveCode,
	depthCode,
	ene,
	perineural,
	lvi,
	...record
}: PatientRecord): string =>
	`${isDepthCodeHazard(depthCode) ? HAZARD_RATIOS.DEPTH_CODE : 0}\
  +${isDysplasiaHazard(dysplasia) ? HAZARD_RATIOS.DYSPLASIA : 0}\
  +${isPerineuralHazard(perineural) ? HAZARD_RATIOS.PERINEURAL : 0}\
  +${isLviHazard(lvi) ? HAZARD_RATIOS.LVI : 0}\
  +${isInvasiveCodeHazard(invasiveCode) ? HAZARD_RATIOS.INVASIVE_CODE : 0}\
  +${isEneHazard(ene) ? HAZARD_RATIOS.ENE : 0}\
  =${getHazard({
		...record,
		dysplasia,
		invasiveCode,
		depthCode,
		ene,
		perineural,
		lvi,
	}).toFixed(2)}`.replace(/\s/g, '')

export const isPerfectMatch = (
	slnbRecord: PatientRecord,
	elndRecord: PatientRecord
): boolean =>
	slnbRecord.dysplasia == elndRecord.dysplasia &&
	slnbRecord.depthCode == elndRecord.depthCode &&
	slnbRecord.ene == elndRecord.ene &&
	slnbRecord.perineural == elndRecord.perineural &&
	slnbRecord.invasiveCode == elndRecord.invasiveCode &&
	slnbRecord.lvi == elndRecord.lvi

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
	} Hazard ratios: ${slnbHazard.toFixed(2)} / ${elndHazard.toFixed(
		2
	)} Diff=${difference.toFixed(2)} ${perfect ? '(perfect)' : ''}`
