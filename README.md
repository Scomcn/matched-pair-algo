# Matched Pair Algorithm

## Purpose

This algorithm is used in a medical study to produce pairs of patient records for statistical analysis of patient outcomes.
The factor of interest is the type of procedure that each patient has undergone; either the SLNB or ELND procedure.

Each patient record contains several variables which are used to calculate each patient's overall _Hazard Ratio_; a measurement of the risk of morbidity.

The algorithm aims to assign patients with the most similar Hazard Ratios to each other, while maintaining _uniqueness_, such that no patient record is paired with more than one other.
(This may result in individual patients being paired with less than perfect matches, but the overall closeness of all matches will be greater).

The list of pairings is then used for _Matched Pair Analysis_, a technique where patients with similar attributes are compared to establish whether the factor of interest (type of procedure, in this case) has an effect on outcomes.

See **Overview.pdf** for a set of slides demonstrating the function of the algorithm.

## Running Instructions

### Prerequisites

- Installed Node.js (v16.9.1 or later)
- Installed Yarn (v1.22.5 or later)
- Navigate to the project directory

### Install dependencies

- From the project directory, run
  `yarn install`

### Add input data

- If you have a correctly formatted CSV file containing patient data, copy it into the `data/input/` folder, and name it `dataset.csv`.

  - Note: the Date of Surgery field must be in the ISO format

- Alternatively, if you don't have a dataset or are unsure about proper formatting, run `yarn generate`. This will create a `dataset.csv` in the correct folder, with randomly generated data.

### Running the algorithm

- Run `yarn all`
  - This will run 3 scripts:
    - import - converts the CSV dataset into JSON files
    - matchPairs - runs the matched pair algorithm on the JSON data
    - export - exports the matched pairs to the file `pairings.csv`

### Retrieving your data

- After running `yarn all`, the results will be available in 2 formats:
  - CSV format, similar to the input format
    - Can be found in `data/output/pairings.csv`
  - JSON format
    - Can be found in `data/output/pairings.json`

### Clean repo

- Clean up the files produced by the script by running `yarn clean`
  - This will not delete `dataset.csv` in the `input` directory
- Clean up all files and folders in `input` and `output` by running `yarn clean:all`
  - This will delete _everything_ inside both `input` and `output`

These operations are not reversible.
