const fs = require("fs").promises;
const readline = require("readline");
const axios = require("axios");

const TBA_API_KEY = process.env.TBA_API_KEY;
const BASE_URL = "https://www.thebluealliance.com/api/v3";
const teamMatchData = [];
const subDataPoints = [
  "autoAmpNotePoints",
  "autoSpeakerNotePoints",
  "autoLeavePoints",
  "teleopAmpNotePoints",
  "teleopSpeakerNotePoints",
  "foulpoints",
  "endgameHarmonyPoints",
  "endgameNoteInTrapPoints",
  "endgameOnStagePoints",
  "endgameParkPoints",
  "endGameSpotLightBonusPoints",
];

const oppTeamMatchStats = [];
for (let i = 0; i < 10000; i++) {
  oppTeamMatchStats.push([]);
}

async function getDataFromFile(filename) {
  try {
    const data = await fs.readFile(filename, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`File not found: ${filename}`);
    } else {
      console.error(`Error reading file ${filename}: ${error.message}`);
    }
    throw error;
  }
}

async function askUserQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + " ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
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
        "X-TBA-Auth-Key": TBA_API_KEY,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching data from TBA: ${error.message}`);
    throw error;
  }
}

async function getTeamData(teamNumber) {
  var teamKey = String(teamNumber);
  if (!teamKey.includes("frc")) {
    teamKey = "frc" + teamNumber;
  }

  const teamData = await getTBAData(
    `/team/${teamKey}/matches/${await askUserQuestion(
      "What year do you want to predict for?"
    )}`
  );

  for (let i = 0; i < teamData.length; i++) {
    if (teamData[i].alliances.red.team_keys.includes(teamKey)) {
      teamMatchData.push({
        teamStats: teamData[i].score_breakdown.red,
        oppTeams: teamData[i].alliances.blue.team_keys,
        comp: teamData[i].key,
        time: teamData[i].time,
      });
      for (let j = 0; j < teamData[i].alliances.blue.team_keys.length; j++) {
        oppTeamMatchStats[
          +teamData[i].alliances.blue.team_keys[j].substring(3)
        ].push({
          teamStats: teamData[i].score_breakdown.blue,
          comp: teamData[i].event_key,
          time: teamData[i].time,
        });
      }
    } else {
      teamMatchData.push({
        teamStats: teamData[i].score_breakdown.blue,
        oppStats: teamData[i].alliances.red.team_keys,
        comp: teamData[i].key,
        time: teamData[i].time,
      });
      for (let j = 0; j < teamData[i].alliances.red.team_keys.length; j++) {
        oppTeamMatchStats[
          +teamData[i].alliances.red.team_keys[j].substring(3)
        ].push({
          teamStats: teamData[i].score_breakdown.red,
          comp: teamData[i].event_key,
          time: teamData[i].time,
        });
      }
    }
  }
}

async function predictData(dataPoint) {
  const trainedNumbers = await getDataFromFile("trainedNumbers.json");

  if (!subDataPoints.includes(dataPoint)) {
    if (dataPoint.includes("auto")) {
      let ret = 0;
      for (let i = 0; i < subDataPoints.length; i++) {
        if (subDataPoints[i].includes("auto")) {
          ret += predictData(subDataPoints[i]);
        }
      }
      return ret;
    } else if (dataPoint.includes("teleop")) {
      let ret = 0;
      for (let i = 0; i < subDataPoints.length; i++) {
        if (subDataPoints[i].includes("teleop")) {
          ret += predictData(subDataPoints[i]);
        }
      }
      return ret;
    } else if (dataPoint.includes("endgame")) {
      let ret = 0;
      for (let i = 0; i < subDataPoints.length; i++) {
        if (subDataPoints[i].includes("endgame")) {
          ret += predictData(subDataPoints[i]);
        }
      }
      return ret;
    } else {
      let ret = 0;
      for (let i = 0; i < subDataPoints.length; i++) {
        ret += predictData(subDataPoints[i]);
      }
      return ret;
    }
  }

  var inputs = [
    teamMatchData.reduce((sum, val) => sum + val.teamStats[dataPoint], 0) /
      teamMatchData.length,
    teamMatchData.reduce((sum, val) => {
      if (val.comp === teamMatchData[j].comp) {
        return sum + val.teamStats[dataPoint];
      }
      return sum;
    }, 0) / matchesInComp,
    teamMatchData
      .slice(-3)
      .reduce(
        (last, val) =>
          last > val.teamStats[dataPoint] ? last : val.teamStats[dataPoint],
        0
      ) / 3,
    teamMatchData[teamMatchData.length - 1].teamStats[dataPoint],
    (teamMatchData[j].oppTeams.reduce((sum, val) => {
      if (!oppTeamMatchStats[+val.substring(3)]) {
        oppTeamsThatHaveData--;
        return sum;
      }
      return (
        sum +
        oppTeamMatchStats[+val.substring(3)].reduce(
          (sum, val) => sum + val.teamStats[dataPoint],
          0
        ) /
          oppTeamMatchStats[+val.substring(3)].length
      );
    }, 0) *
      (1 + oppTeamsThatHaveData)) /
      3,
    (teamMatchData[j].oppTeams.reduce(
      (sum, val) =>
        oppTeamMatchStats[+val.substring(3)]
          ? sum +
            oppTeamMatchStats[+val.substring(3)].reduce((sum, val) => {
              if (val.comp === teamMatchData[j].comp) {
                matchesInCompOpp++;
                return sum + val.teamStats[dataPoint];
              }
              return sum;
            }, 0) /
              oppTeamMatchStats[+val.substring(3)].length
          : sum,
      0
    ) *
      (1 + oppTeamsThatHaveData)) /
      3,
  ];

  function prediction(dataPoint) {
    let ret = 0;
    for (let i = 0; i < inputs.length; i++) {
      ret += trainedNumbers[dataPoint].a[i] * inputs[i] ** 3;
      ret += trainedNumbers[dataPoint].b[i] * inputs[i] ** 2;
      ret += trainedNumbers[dataPoint].c[i] * inputs[i];
    }
    ret += trainedNumbers[dataPoint].d;
    return ret;
  }

  return prediction(dataPoint);
}

async function main() {
  const teamNumber = await askUserQuestion("Enter your team number: ");
  const dataPoint = await askUserQuestion("Enter the data point to predict: ");

  await getTeamData(teamNumber);
  const prediction = await predictData(dataPoint);

  console.log(`Predicted ${dataPoint} for team ${teamNumber}: ${prediction}`);
}

main();
