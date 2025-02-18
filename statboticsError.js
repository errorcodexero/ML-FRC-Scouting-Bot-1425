const axios = require("axios");

const STATBOTICS_API_URL = "https://api.statbotics.io/v2";
const YEAR = 2024; // Change this to the desired year

/**
 * Fetches match data from the Statbotics API for a given year.
 *
 * @param {number} year - The year for which to fetch match data.
 * @returns {Promise<Array>} A promise that resolves with the match data.
 */
async function fetchMatchData(year) {
  try {
    const response = await axios.get(
      `${STATBOTICS_API_URL}/matches?year=${year}`
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching match data: ${error.message}`);
    throw error;
  }
}

/**
 * Calculates the average error between predicted and actual match scores.
 *
 * @param {Array} matches - An array of match data.
 * @returns {number} The average error.
 */
function calculateAverageError(matches) {
  let totalError = 0;
  let matchCount = 0;

  matches.forEach((match) => {
    if (match.predicted_score && match.actual_score) {
      const error = Math.abs(match.predicted_score - match.actual_score);
      totalError += error;
      matchCount++;
    }
  });

  return matchCount > 0 ? totalError / matchCount : 0;
}

/**
 * Main function to fetch match data and calculate the average error.
 */
async function main() {
  try {
    const matches = await fetchMatchData(YEAR);
    const averageError = calculateAverageError(matches);
    console.log(`Average error for ${YEAR}: ${averageError.toFixed(3)}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main();
