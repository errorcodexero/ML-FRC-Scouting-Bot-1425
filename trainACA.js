const axios = require("axios");
const readline = require("readline");
const fs = require("fs");

const TBA_API_KEY = process.env.TBA_API_KEY; // Replace with your actual TBA API key
const BASE_URL = "https://www.thebluealliance.com/api/v3";

const LEARNING_RATE0 = 0.00001;
const LEARNING_RATE1 = 0.000001;
const LEARNING_RATE2 = 0.000000001;
const LEARNING_RATE3 = 0.00000000000001;
const DONE_THRESH = 0.1;
const matchStats = [];
const matchData = {};
let trainedNumbers = {};
//const H = 0.00000000000000001;

// THIS CHANGES PER YEAR
// replace with data for current year
// this is for 2024
const trainingPoints = [
  "autoAmpNotePoints",
  "autoSpeakerNotePoints",
  "autoLeavePoints",
  "teleopAmpNotePoints",
  "teleopSpeakerNotePoints",
  "foulPoints",
  "endGameHarmonyPoints",
  "endGameNoteInTrapPoints",
  "endGameOnStagePoints",
  "endGameParkPoints",
  "endGameSpotLightBonusPoints",
];

//WARNING:
//EVERYTHING IN HERE IS WRITTEN BY TABNINE, AN AI

//I WAS TOO LAZY TO WRITE THESE USEFUL BITS OF CODE MYSELF
//THIS IS NOT THE REAL MEAT, I CODED ALL THE ACTUAL TRAINING STUFF MYSELF
//AI IS KINDA THE BEST FOR CODING THOUGH
//ALSO ALL THE COMMENTS ARE WRITTEN BY AI, AND CHECKED BY ME
//I HATE COMMENTING MY CODE SO I LOVE THIS TOOL
//IMMA STOP RAMBLING IN CAPSLOCK NOW
const AI_FUNCS = {
  /**
   * Prompts the user to enter a year for training data and validates the input.
   *
   * This function creates a readline interface to get user input from the console.
   * It asks the user to enter a year, validates that the input is a number between 1992
   * and the current year, and returns the validated year as a Promise.
   *
   * @async
   * @function getYearFromUser
   * @returns {Promise<number>} A Promise that resolves with the validated year as a number.
   * @throws {Error} If there's an issue with the readline interface or Promise resolution.
   */
  getYearFromUser: async function () {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question("Enter the year you want to train data on: ", (year) => {
        rl.close();
        const parsedYear = parseInt(year);
        if (
          isNaN(parsedYear) ||
          parsedYear < 1992 ||
          parsedYear > new Date().getFullYear()
        ) {
          console.log(
            "Invalid year. Please enter a valid year between 1992 and the current year."
          );
          resolve(getYearFromUser()); // Recursively ask for input if invalid
        } else {
          resolve(parsedYear);
        }
      });
    });
  },

  /**
   * Asynchronously adds new data to a JSON file, creating the file if it doesn't exist.
   *
   * This function reads an existing JSON file (if it exists), merges new data with the existing data,
   * and writes the updated data back to the file. If the file doesn't exist, it creates a new file
   * with the provided data.
   *
   * @async
   * @param {string} filename - The name of the JSON file to read from and write to.
   * @param {Object} newData - An object containing the new data to be added to the JSON file.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  writeToJsonFile: async function (filename, newData) {
    let data = newData;

    // Write updated data back to file
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  },

  /**
   * Fetches data from The Blue Alliance API for a given endpoint.
   *
   * This function makes an asynchronous GET request to The Blue Alliance API
   * using the provided endpoint. It includes the necessary authentication
   * header for API access.
   *
   * @async
   * @param {string} endpoint - The API endpoint to fetch data from, excluding the base URL.
   * @returns {Promise<Object>} A promise that resolves with the data returned from the API.
   * @throws {Error} If there's an error fetching data from the API, the error is logged and re-thrown.
   */
  getTBAData: async function (endpoint) {
    try {
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        headers: {
          "X-TBA-Auth-Key": TBA_API_KEY,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching data from TBA:`);
      //throw error;
    }
  },

  /**
   * Deletes the last line of the console output.
   * This function uses ANSI escape codes to move the cursor up one line and clear it.
   */
  deleteLastConsoleLine: function () {
    process.stdout.write("\x1b[1A"); // Move cursor up one line
    process.stdout.write("\x1b[2K"); // Clear the entire line
  },
};

/**
 * Fetches and processes match data for a given year from The Blue Alliance API.
 *
 * This function retrieves all events for the specified year, then fetches match data
 * for each event. It processes this data and populates the global `matchStats` array
 * with detailed statistics for each team's performance in their matches.
 *
 * @async
 * @param {number} year - The year for which to fetch match data.
 * @returns {Promise<void>} A promise that resolves when all match data has been fetched and processed.
 * @throws {Error} If there's an error fetching or processing the data.
 */
async function getMatchData(year) {
  events = await AI_FUNCS.getTBAData(`/events/${year}/keys`);
  let matches = [];
  for (let i = 0; i < events.length; i++) {
    let data = await AI_FUNCS.getTBAData(`/event/${events[i]}/matches`);
    AI_FUNCS.deleteLastConsoleLine();
    console.log(`${((i * 100) / events.length).toFixed(1)}% data fetched...`);
    matches.push(...data);
  }
  // need to get the data for each match and put it into matchStats
  // i think this was a reminder but imma leave it anyway
  for (let i = 0; i < 10000; i++) {
    matchStats.push([]);
  }
  for (let i = 0; i < matches.length; i++) {
    for (let j = 0; j < matches[i].alliances.red.team_keys.length; j++) {
      if (
        matchStats[+matches[i].alliances.red.team_keys[j].substring(3)] ===
          undefined ||
        !matches[i].score_breakdown
      ) {
        continue;
      }
      matchStats[+matches[i].alliances.red.team_keys[j].substring(3)].push({
        teamStats: matches[i].score_breakdown.red,
        oppTeams: matches[i].alliances.blue.team_keys,
        comp: matches[i].key,
        time: matches[i].time,
      });
    }
    for (let j = 0; j < matches[i].alliances.blue.team_keys.length; j++) {
      if (
        matchStats[+matches[i].alliances.blue.team_keys[j].substring(3)] ===
          undefined ||
        !matches[i].score_breakdown
      ) {
        continue;
      }
      matchStats[+matches[i].alliances.blue.team_keys[j].substring(3)].push({
        teamStats: matches[i].score_breakdown.blue,
        oppTeams: matches[i].alliances.red.team_keys,
        comp: matches[i].event_key,
        time: matches[i].time,
      });
    }
  }
  console.log(`Training data fetched, with ${matches.length} data points!`);
}

/**
 * Initializes the dataset for a specific data point by processing match statistics.
 *
 * This function populates the matchData object with processed statistics for the given dataPoint.
 * It calculates various metrics based on historical match data, including averages, recent performance,
 * and opponent statistics.
 *
 * @async
 * @param {string} dataPoint - The specific data point (e.g., "autoAmpNotePoints") to initialize the dataset for.
 * @returns {Promise<void>} A promise that resolves when the dataset initialization is complete.
 */
async function initializeDataset(dataPoint) {
  console.log(`Training data initializing...`);
  matchData[dataPoint] = [];
  let oppTeamsThatHaveData = 3;
  for (let i = 0; i < matchStats.length; i++) {
    for (let j = 0; j < matchStats[i].length; j++) {
      let matchesInCompOpp = 0;
      let teamMatchStatsBeforeThisMatch = matchStats[i]
        .filter((val) => val.time < matchStats[i][j].time)
        .sort((a, b) => a.time < b.time);
      if (teamMatchStatsBeforeThisMatch.length == 0) {
        continue;
      }
      let matchesInComp = teamMatchStatsBeforeThisMatch.reduce((sum, val) => {
        if (val.comp == matchStats[i][j].comp) {
          return sum + 1;
        }
        return sum;
      }, 0);
      if (matchesInComp === 0) {
        continue;
      }
      matchData[dataPoint].push({
        inputs: [
          teamMatchStatsBeforeThisMatch.reduce(
            (sum, val) => sum + val.teamStats[dataPoint],
            0
          ) / teamMatchStatsBeforeThisMatch.length,
          teamMatchStatsBeforeThisMatch.reduce((sum, val) => {
            if (val.comp === matchStats[i][j].comp) {
              return sum + val.teamStats[dataPoint];
            }
            return sum;
          }, 0) / matchesInComp,
          teamMatchStatsBeforeThisMatch
            .slice(-3)
            .reduce(
              (last, val) =>
                last > val.teamStats[dataPoint]
                  ? last
                  : val.teamStats[dataPoint],
              0
            ) / 3,
          teamMatchStatsBeforeThisMatch[
            teamMatchStatsBeforeThisMatch.length - 1
          ].teamStats[dataPoint],
          (matchStats[i][j].oppTeams.reduce((sum, val) => {
            if (!matchStats[+val.substring(3)]) {
              oppTeamsThatHaveData--;
              return sum;
            }
            return (
              sum +
              matchStats[+val.substring(3)].reduce(
                (sum, val) => sum + val.teamStats[dataPoint],
                0
              ) /
                matchStats[+val.substring(3)].length
            );
          }, 0) *
            (1 + oppTeamsThatHaveData)) /
            3,
          (matchStats[i][j].oppTeams.reduce(
            (sum, val) =>
              matchStats[+val.substring(3)]
                ? sum +
                  matchStats[+val.substring(3)].reduce((sum, val) => {
                    if (val.comp === matchStats[i][j].comp) {
                      matchesInCompOpp++;
                      return sum + val.teamStats[dataPoint];
                    }
                    return sum;
                  }, 0) /
                    matchStats[+val.substring(3)].length
                : sum,
            0
          ) *
            (1 + oppTeamsThatHaveData)) /
            3,
        ],
        actual: matchStats[i][j].teamStats[dataPoint],
      });
    }
  }
}

/**
 * Trains a predictive model for a specific data point using match data.
 *
 * This function initializes model parameters, performs iterative training to minimize prediction error,
 * and saves the trained model weights to a JSON file. It uses a cubic polynomial regression approach
 * with gradient descent for optimization.
 *
 * @async
 * @param {string} dataPoint - The specific data point (e.g., "autoAmpNotePoints") to train the model on.
 * @returns {Promise<void>} A promise that resolves when the training is complete and weights are saved.
 */
async function trainData(dataPoint) {
  console.log(`Training started for ${dataPoint}!`);
  trainedNumbers[dataPoint] = {
    a: [0, 0, 0, 0, 0, 0],
    b: [0, 0, 0, 0, 0, 0],
    c: [0, 0, 0, 0, 0, 0],
    d: 0,
  };

  function prediction(index) {
    let ret = 0;
    for (let i = 0; i < matchData[dataPoint][index].inputs.length; i++) {
      ret +=
        trainedNumbers[dataPoint].a[i] *
        matchData[dataPoint][index].inputs[i] ** 3;
      ret +=
        trainedNumbers[dataPoint].b[i] *
        matchData[dataPoint][index].inputs[i] ** 2;
      ret +=
        trainedNumbers[dataPoint].c[i] * matchData[dataPoint][index].inputs[i];
    }
    ret += trainedNumbers[dataPoint].d;
    return ret;
  }

  function avgError() {
    let sum = 0;
    for (let i = 0; i < matchData[dataPoint].length; i++) {
      sum += Math.abs(prediction(i) - matchData[dataPoint][i].actual) ** 2;
    }
    return sum / matchData[dataPoint].length;
  }

  function updateWeights() {
    function errDerivitave(i, power, dataIndex) {
      let chain1 = 2 * (prediction(i) - matchData[dataPoint][i].actual); // derivitave of error with respect to prediction
      let chain2 = matchData[dataPoint][i].inputs[dataIndex] ** power; // derivative of prediction with respect to input
      return chain1 * chain2;
    }
    for (let i = 0; i < matchData[dataPoint].length; i++) {
      for (let j = 0; j < matchData[dataPoint][i].inputs.length; j++) {
        trainedNumbers[dataPoint].a[j] -=
          LEARNING_RATE3 * errDerivitave(i, 3, j);
        trainedNumbers[dataPoint].b[j] -=
          LEARNING_RATE2 * errDerivitave(i, 2, j);
        trainedNumbers[dataPoint].c[j] -=
          LEARNING_RATE1 * errDerivitave(i, 1, j);
      }
      trainedNumbers[dataPoint].d += LEARNING_RATE0 * errDerivitave(i, 0, 0);
    }
  }

  console.log(`Training data...`);
  var iters = 0;
  let lastError = avgError() + DONE_THRESH + 1; // has to trigger first iteration, shows that my starting values sucked
  while (lastError - avgError() > DONE_THRESH || iters < 2) {
    iters++;
    lastError = avgError();
    updateWeights();
    // number should go down
    AI_FUNCS.deleteLastConsoleLine();
    console.log(`Error: ${Math.sqrt(avgError()).toFixed(5)}`);
  }

  console.log(`Training completed!`);
  console.log(`Saving weights...`);

  // save trainedNumbers to a json file
  await AI_FUNCS.writeToJsonFile("trainedNumbers.json", trainedNumbers);

  console.log(`Done training ${dataPoint}!`);
}

/**
 * The main function that orchestrates the entire process of fetching, initializing, and training data.
 *
 * This asynchronous function performs the following steps:
 * 1. Prompts the user for a year.
 * 2. Fetches match data for the specified year.
 * 3. Initializes and trains datasets for each data point defined in trainingPoints.
 *
 * @async
 * @function main
 * @returns {Promise<void>} A promise that resolves when all operations are complete.
 */
async function main() {
  console.log("Starting!");
  const year = await AI_FUNCS.getYearFromUser();
  await getMatchData(year);
  for (let i = 0; i < trainingPoints.length; i++) {
    await initializeDataset(trainingPoints[i]);
    await trainData(trainingPoints[i]);
  }
  console.log("Done!");
}

main();
//somehow my stupidly inefficient code runs kinda fast
//proof that js is better than python
