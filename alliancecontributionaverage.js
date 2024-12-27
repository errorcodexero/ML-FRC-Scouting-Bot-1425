const axios = require('axios');
const readline = require('readline');

const TBA_API_KEY = process.env.TBA_API_KEY ; // Replace with your actual TBA API key
const BASE_URL = 'https://www.thebluealliance.com/api/v3';

const LEARNING_RATE0 = 0.0;
const LEARNING_RATE1 = 0.00000000001;
const LEARNING_RATE2 = 0.0;
const DONE_THRESH = 0.01;
const matchStats = [];
const matchData = {};
let trainedNumbers = {}
//const H = 0.00000000000000001;

// THIS CHANGES PER YEAR
// replace with data for current year
// this is for 2024
const subDataPoints = ["autoAmpNotePoints", "autoSpeakerNotePoints", "autoLeavePoints", "teleopAmpNotePoints", "teleopSpeakerNotePoints", "foulpoints", "endgameHarmonyPoints", "endgameNoteInTrapPoints", "endgameOnStagePoints", "endgameParkPoints", "endGameSpotLightBonusPoints"];


//const INDIVIDUAL_DONE_THRESH = 0.8;
//const DONE_THRESH = 0.00005;

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
async function getYearFromUser() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter the year you want to train data on: ', (year) => {
      rl.close();
      const parsedYear = parseInt(year);
      if (isNaN(parsedYear) || parsedYear < 1992 || parsedYear > new Date().getFullYear()) {
        console.log('Invalid year. Please enter a valid year between 1992 and the current year.');
        resolve(getUserInputYear()); // Recursively ask for input if invalid
      } else {
        resolve(parsedYear);
      }
    });
  });
}


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
async function addToJsonFile(filename, newData) {
  let data = {};

  // Read existing file if it exists
  if (fs.existsSync(filename)) {
    const fileContent = fs.readFileSync(filename, 'utf8');
    data = JSON.parse(fileContent);
  }

  // Add new data
  Object.assign(data, newData);

  // Write updated data back to file
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}


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
async function getTBAData(endpoint) {
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: {
        'X-TBA-Auth-Key': TBA_API_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching data from TBA: ${error.message}`);
    throw error;
  }
}


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
  events = await getTBAData(`events/${year}/keys`);
  let matches = [];
  for(let i = 0; i < events.length; i++){
    matches.push(...(await getTBAData(`/event/${events[i]}/matches`)));
  }
  // need to get the data for each match and put it into matchStats
  for(let i = 0; i < 10000; i ++){
    matchStats.push([]);
  }
  for(let i = 0; i < matches.length; i++){
    for (let j = 0; j < matches[i].alliances.red.team_keys.length; j++){
      matchStats[matches[i].alliances.red.team_keys[j].substring(3).parseInt()].push({teamStats: matches[i].score_breakdown.red, oppStats: matches[i].score_breakdown.blue, comp: matches[i].key, time: matches[i].time});
    }
    for (let j = 0; j < matches[i].alliances.blue.team_keys.length; j++){
      matchStats[matches[i].alliances.blue.team_keys[j].substring(3).parseInt()].push({teamStats: matches[i].score_breakdown.blue, oppStats: matches[i].score_breakdown.red, comp: matches[i].key, time: matches[i].time});
    }
  }
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
async function initializeDataset(dataPoint){
  console.log(`Training data initializing...`);
  matchData[dataPoint] = [];
  for(let i = 0; i < matchStats.length; i++){
    for(let j = 0; j < matchStats[i].length; j++){
      let matchesInComp = 0;
      let matchesInCompOpp = 0;
      let teamMatchStatsBeforeThisMatch = matchStats[i].filter((val) => val.time < matchStats[i][j].time);
      matchData[dataPoint].push({
        inputs: [teamMatchStatsBeforeThisMatch.reduce((sum, val) => sum + val.teamStats[dataPoint], 0)/teamMatchStatsBeforeThisMatch.length,
          teamMatchStatsBeforeThisMatch.reduce((sum, val) => {
            if(val.comp === teamMatchStatsBeforeThisMatch[j].comp){
              matchesInComp++;
              return sum + val.teamStats[dataPoint];
            }
            return sum;
          }, 0)/matchesInComp,
          teamMatchStatsBeforeThisMatch.slice(-3).reduce((last, val) => last > val.teamStats[dataPoint] ? last : val.teamStats[dataPoint], 0)/3,
          teamMatchStatsBeforeThisMatch[j].teamStats[dataPoint],
          teamMatchStatsBeforeThisMatch[j].oppTeams.reduce((sum, val) => sum + matchStats[val].reduce((sum, val) => sum + val.oppStats[dataPoint], 0)/matchStats[val].length, 0)/3,
          teamMatchStatsBeforeThisMatch[j].oppTeams.reduce((sum, val) => sum + matchStats[val].reduce((sum, val) => {
            if(val.comp === teamMatchStatsBeforeThisMatch[j].comp){
              matchesInCompOpp++;
              return sum + val.oppStats[dataPoint];
            }
            return sum;
          }, 0)/matchStats[val].length, 0)/3
        ],
        actual: matchStats[j].teamStats[dataPoint],
      });
    }
  }
  console.log(`Training data initialized!`);
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
async function trainData(dataPoint){
  console.log(`Training started!`);
  trainedNumbers[dataPoint] = {a: [0, 0, 0, 0, 0, 0], b: [0, 0, 0, 0, 0, 0], c: [0, 0, 0, 0, 0, 0], d: 0};
  function prediction(index){
    let ret = 0;
    for(let i = 0; i < matchData[dataPoint][index].preds.length; i++){
      ret += trainedNumbers[dataPoint].a[i] * matchData[dataPoint][index].preds[i] ** 3;
      ret += trainedNumbers[dataPoint].b[i] * matchData[dataPoint][index].preds[i] ** 2;
      ret += trainedNumbers[dataPoint].c[i] * matchData[dataPoint][index].preds[i];
    }
    ret += trainedNumbers[dataPoint].d;
    return ret;
  }

  function avgError(){
    let sum = 0;
    for(let i = 0; i < matchData[dataPoint].length; i++){
      sum += Math.abs(prediction(i) - matchData[dataPoint][i].actual);
    }
    return sum / matchData[dataPoint].length;
  }

  function updateWeights(){
    for(let i = 0; i < matchData[dataPoint].length; i++){
      function errDerivitave(power, dataIndex){
        let chain1 = 2 * (prediction(i) - matchData[dataPoint][i].actual); // derivitave of error with respect to prediction
        let chain2 = matchData[dataPoint][i].preds[dataIndex] ** power; // derivative of prediction with respect to input
        return chain1 * chain2
      }
      for(let j = 0; j < matchData[dataPoint][i].preds.length; j++){
        trainedNumbers[dataPoint].a[j] -= LEARNING_RATE0 * errDerivitave(3, j);
        trainedNumbers[dataPoint].b[j] -= LEARNING_RATE1 * errDerivitave(2, j);
        trainedNumbers[dataPoint].c[j] -= LEARNING_RATE2 * errDerivitave(1, j);
      }
      trainedNumbers[dataPoint].d += LEARNING_RATE0 * errDerivitave(0, 0);
    }
    // one iteration done! now print info
    // number should go down
    console.log(`Avg Error: ${avgError().toFixed(5)}`);
  }

  console.log(`Training data...`);

  let lastError = avgError();
  let error = 0;

  while (lastError - error > DONE_THRESH){
    lastError = avgError();
    updateWeights();
    error = avgError();
  }

  console.log(`Training completed!`);
  console.log(`Saving weights...`);

  // save trainedNumbers to a json file
  await addToJsonFile('trainedNumbers.json', trainedNumbers)

  console.log(`Done training ${dataPoint}!`);
}



async function main() {
  console.log("Starting!");
  const year = await getUserInputYear();
  await getMatchData(year);
  for(let i = 0; i < subDataPoints.length; i++){
    await initializeDataset(subDataPoints[i]);
    await trainData(subDataPoints[i]);
  }
  console.log("Done!")
}

main();
