#!/usr/bin/env ts-node

// This file will generate a sample CSV data set with random data
import fs from 'fs'

import { CSV_PATH } from '../config';

// These headers must be in this order, since they're parsed in order in importCsv.ts
const HEADERS =
	'gender code,Date of Surgery,Depth Code,Dysplasia present,Perineural,LVI,Inv Front code,ENE,SLNB ,ELND'

const getRandomInRange = (n1: number, n2: number): number =>
	Math.round(n1 + Math.random() * (n2 - n1))

const generateGenderCode = () => getRandomInRange(1, 2)

// Random date between 2001 and 2020
const generateDate = () =>
	new Date(getRandomInRange(1000000000000, 1600000000000)).toISOString()

const generateDepthCode = () => getRandomInRange(1, 3)

const generateDysplasia = () => getRandomInRange(0, 1)

const generatePerineural = () => getRandomInRange(0, 1)

const generateLvi = () => getRandomInRange(0, 1)

const generateInvFrontCode = () => getRandomInRange(1, 2)

const generateEne = () => getRandomInRange(0, 1)

// This is weighted such that ELND appears twice as often as SLNB.
// The algorithm requires that the list of ELND records is longer than the list of ELND records.
const getSlnbOrElnd = () => (getRandomInRange(0, 2) ? [0, 1] : [1, 0])

const generateRow = () =>
	[
		generateGenderCode(),
		generateDate(),
		generateDepthCode(),
		generateDysplasia(),
		generatePerineural(),
		generateLvi(),
		generateInvFrontCode(),
		generateEne(),
		...getSlnbOrElnd(),
	].join(',')

const generateFile = () => {
	const rows = Array.from({ length: getRandomInRange(100, 200) }, generateRow)
	return [HEADERS, ...rows].join('\n')
}

console.time('Generating random dataset...')
const file = generateFile()
console.timeEnd('Generating random dataset...')

console.time(`Writing generated file to "${CSV_PATH}"...`);
// Do not overwrite the existing dataset if it exists
if (fs.existsSync(CSV_PATH)) {
  console.error(
    `The file "${CSV_PATH}" already exists. Please move or delete the file and try again.\n`,
    'Tip: use `npm run clean:all` to delete all files in data/input and data/output.',
  );
  process.exit(1);
}
fs.writeFileSync(CSV_PATH, file);
console.timeEnd(`Writing generated file to "${CSV_PATH}"...`);
