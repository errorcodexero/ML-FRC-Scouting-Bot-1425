const fs = require("fs").promises;
const readline = require("readline");
const axios = require("axios");

/**
 * Deletes the last line of the console output.
 * This function uses ANSI escape codes to move the cursor up one line and clear it.
 */
const deleteLastConsoleLine = function () {
  process.stdout.write("\x1b[1A"); // Move cursor up one line
  process.stdout.write("\x1b[2K"); // Clear the entire line
};
// prediction mode being totalPoints means that the match will go for the totalPoints training data, // edit later: was weirdge
// if it is anything else (should be "match" though), then it will iterate through the weights through all the data.
const predictionMode = "match";
const TBA_API_KEY = process.env.TBA_API_KEY;
const BASE_URL = "https://www.thebluealliance.com/api/v3";
const teamMatchStats = [];
const subDataPoints = [
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
let fullTeamData;
let trainedNumbers;
let allMatchesInYear;

const oppTeamOppMatchStats = [];
for (let i = 0; i < 10000; i++) {
  oppTeamOppMatchStats.push([]);
}

/**
 * Asynchronously reads and parses JSON data from a file.
 *
 * This function attempts to read the contents of a file specified by the filename,
 * parse it as JSON, and return the resulting JavaScript object. If an error occurs
 * during file reading or JSON parsing, it logs an appropriate error message and
 * throws the error.
 *
 * @async
 * @param {string} filename - The name or path of the file to read.
 * @returns {Promise<Object>} A promise that resolves with the parsed JSON data as a JavaScript object.
 * @throws {Error} If the file is not found or cannot be read, or if the content cannot be parsed as JSON.
 */
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

/**
 * Prompts the user with a question and returns their answer asynchronously.
 *
 * This function creates a readline interface to ask the user a question via
 * the command line. It returns a Promise that resolves with the user's trimmed answer.
 *
 * @async
 * @param {string} question - The question to ask the user.
 * @returns {Promise<string>} A promise that resolves with the user's trimmed answer.
 */
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

/**
 * Fetches and processes match data for a given team and their opponents.
 *
 * This function retrieves match data for the specified team and their opponents
 * from The Blue Alliance API for a given year. It then sorts and filters the data,
 * and populates the `teamMatchStats` and `oppTeamMatchStats` arrays with the
 * relevant information.
 *
 * @param {number} teamNumber - The number of the team for which to fetch match data.
 * @param {Array<number>} oppTeams - An array of the numbers of the opponent teams.
 * @returns {Promise<void>} - A promise that resolves when the data fetching and processing is complete.
 * @throws {Error} - If there's an error fetching data from the API, the error is logged and re-thrown.
 */
async function getTeamData(teamNumber, oppTeams, year) {
  var teamKey = String(teamNumber);
  if (!teamKey.includes("frc")) {
    teamKey = "frc" + teamNumber;
  }

  let fullTeamData = await allMatchesInYear.filter(
    (val) =>
      val.alliances.blue.team_keys.includes(teamKey) ||
      val.alliances.red.team_keys.includes(teamKey)
  );

  fullTeamData = await fullTeamData.sort(
    (a, b) => a.actual_time < b.actual_time
  );

  const teamData = await fullTeamData.filter(
    (val) => val.actual_time < Date.now()
  );

  for (let i = 0; i < teamData.length; i++) {
    let contd = false;
    if (!teamData[i].score_breakdown) {
      continue;
    }
    for (let j = 0; j < subDataPoints.length; j++) {
      if (
        isNaN(teamData[i].score_breakdown.red[subDataPoints[j]]) ||
        isNaN(teamData[i].score_breakdown.blue[subDataPoints[j]])
      ) {
        contd = true;
        break;
      }
    }
    if (contd) {
      continue;
    }
    if (teamData[i].alliances.red.team_keys.includes(teamKey)) {
      teamMatchStats.push({
        teamStats: teamData[i].score_breakdown.red,
        oppTeams: teamData[i].alliances.blue.team_keys,
        comp: teamData[i].key,
        time: teamData[i].actual_time,
      });
    } else {
      teamMatchStats.push({
        teamStats: teamData[i].score_breakdown.blue,
        oppTeams: teamData[i].alliances.red.team_keys,
        comp: teamData[i].key,
        time: teamData[i].actual_time,
      });
    }
  }

  for (let i = 0; i < oppTeams.length; i++) {
    let oppTeamData = await getTBAData(`/team/${teamKey}/matches/${year}`);

    oppTeamData = await oppTeamData
      .sort((a, b) => a.actual_time < b.actual_time)
      .filter((val) => val.actual_time < Date.now());

    for (let j = 0; j < oppTeamData.length; j++) {
      let contd = false;
      if (!oppTeamData[j].score_breakdown) {
        continue;
      }
      for (let k = 0; k < subDataPoints.length; k++) {
        if (
          isNaN(oppTeamData[j].score_breakdown.red[subDataPoints[k]]) ||
          isNaN(oppTeamData[j].score_breakdown.blue[subDataPoints[k]])
        ) {
          contd = true;
          break;
        }
      }
      if (contd) {
        continue;
      }
      if (oppTeamData[j].alliances.red.team_keys.includes(oppTeams[i])) {
        oppTeamOppMatchStats[oppTeams[i]].push({
          oppStats: oppTeamData[j].score_breakdown.blue,
          comp: oppTeamData[j].key,
          time: oppTeamData[j].actual_time,
        });
      } else {
        oppTeamOppMatchStats[oppTeams[i]].push({
          oppStats: oppTeamData[j].score_breakdown.red,
          comp: oppTeamData[j].key,
          time: oppTeamData[j].actual_time,
        });
      }
    }
  }
  return [teamMatchStats, oppTeamOppMatchStats];
}

/**
 * Predicts data for a specific data point in a robotics competition.
 *
 * This function analyzes historical match data and opponent data to predict
 * the performance of a team for a given data point. It handles various game
 * phases (auto, teleop, endgame) and uses a trained model for prediction.
 *
 * @async
 * @param {string} dataPoint - The specific data point to predict (e.g., "auto_points", "teleop_points").
 * @param {number} teamNumber - The team number for which the prediction is being made.
 * @param {Array<string>} oppTeams - An array of opponent team numbers.
 * @param {Array<Object>} teamMatchStats - Historical match statistics for the team.
 * @param {Object} oppTeamOppMatchStats - Historical match statistics for opponent teams.
 * @returns {Promise<number|string>} A promise that resolves to the predicted value for the data point,
 *                                   or a string message if there's insufficient data.
 */
async function predictData(
  dataPoint,
  teamNumber,
  oppTeams,
  teamMatchStats,
  oppTeamOppMatchStats
) {
  if (!subDataPoints.includes(dataPoint)) {
    let ret = 0;
    if (dataPoint.includes("auto")) {
      for (let i = 0; i < subDataPoints.length; i++) {
        if (subDataPoints[i].includes("auto") && typeof ret == "number") {
          ret += await predictData(
            subDataPoints[i],
            teamNumber,
            oppTeams,
            teamMatchStats,
            oppTeamOppMatchStats
          );
        }
      }
    } else if (dataPoint.includes("teleop")) {
      for (let i = 0; i < subDataPoints.length; i++) {
        if (subDataPoints[i].includes("teleop") && typeof ret == "number") {
          ret += await predictData(
            subDataPoints[i],
            teamNumber,
            oppTeams,
            teamMatchStats,
            oppTeamOppMatchStats
          );
        }
      }
    } else if (dataPoint.includes("endgame")) {
      for (let i = 0; i < subDataPoints.length; i++) {
        if (subDataPoints[i].includes("endgame") && typeof ret == "number") {
          ret += await predictData(
            subDataPoints[i],
            teamNumber,
            oppTeams,
            teamMatchStats,
            oppTeamOppMatchStats
          );
        }
      }
    } else {
      for (let i = 0; i < subDataPoints.length; i++) {
        if (typeof ret == "number") {
          ret += await predictData(
            subDataPoints[i],
            teamNumber,
            oppTeams,
            teamMatchStats,
            oppTeamOppMatchStats
          );
        }
      }
    }
    return ret;
  }

  if (teamMatchStats.length == 0 || oppTeamOppMatchStats.length == 0) {
    // console.log(
    //   teamMatchStats.length == 0
    //     ? "No data found for team " + teamNumber
    //     : `No opp team data found for ${oppTeams}`
    // );
    return `
                                                                                                    \n
                                                              ,@@@@@@@@@@@,                         \n
                                                     @@@@@@@@@@@      @-   @@@@                     \n
                                                 @@@@=           @  @@ +@    =@@@                   \n
                                              @@@      @@-      @@@@* @ @@ .      @                 \n
                                           @@+  :    @@  @@@@%+@:@@@@ @:   @@@@@@@@@@               \n
                                       @@@%  .:.:. @@  @:           :@  @@@          @              \n
                                    @@@-  ::::.--:   @.  .:-.   +@@@@.@@      @@@@@   @             \n
                                @@@+  .::......  ..@   -:  =#@@@      @      @@@@@@@   @            \n
                            @@@#. ::::::.::::.::. -.    @@@           @     @@@@@  @.  @            \n
                         @@@.  ---:.:....::::..: # @@@@@    @@@@@@    @@    @@@@@ @@@@ @            \n
                     @@@=   .:::......:::.:....- % @      .@@@@@@@   @@  @@@@@@@   @@@@             \n
                  @@@:  :::::....:.:::::::      . @ @@    @@@   @@@ @@@@  @@@@+    @@@ @            \n
                @=-  ::...:..:::::.::::::-. @   .  @  @@@@@@@@@@@@@@    @@@    *@@%     @           \n
              @@= ..   ..:..:............:.  @@+    @@@        @@    -:   @@@@+     ::  @           \n
            *@- .: = @@.       __          :    @@@@@@@@@@@@.:    .:.:::+   @  = :.   .@            \n
            @  :=  @     @@+.#+-*++%%@@@@@=,__               ...:::::::::.:       _,@@@             \n
           @- :-  @   @@                   -*@@@@@@@@=,__                   _,#@@@-   #@            \n
           @  :: :=  @  :--:*@@@@@@@-,_                -@@@@@@@@@@@@@@@@@@@@@= :  .  -@@            \n
            @.:  @.  @  -:::         --#%@@@@@@*.:                          .      @@               \n
             @ . @ . @=               . .        :@@@@@@@@@@@@@#,___  .   .__,@@@@@@                \n
             @     :   @@@@@@@@@@@@@@@@:+,__ .     .            -==**@@@@++=       @                \n
            +@ @ :-..:                  .  @@@@@@*+-:,___                ::= .#@@@                  \n
            @   #.  .:.:.:::............:::       .  :*%@@@@@@@@@@@@@@@@@@@@@@@                     \n
           @+:@   @#   - :..:::::::::::::...:---:::::.             -@@@                             \n
           @::+*=@@ .@    ..:::..::::::::::::::...::.:..     #@@@@@                                 \n
           @:===-:+= @@ @=,_                     __.,--:@@@@                                        \n
           @:=======-:.:-:%@@@@@%=:--=#@@@@@@%%@%+          @@@@@                                   \n
           @:============-=    .-*#*#%***%@@@@@@@@@@@@@@@*%*--+-#@@@                                \n
           @:======================-=----:...        .:-==========.%@@                              \n
           @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                            \n
           +                                                            @                           \n
`;
    //sorry
    //i had fun tho
  }
  let matchesInComp = teamMatchStats.reduce((sum, val) => {
    if (val.comp == teamMatchStats[teamMatchStats.length - 1].comp) {
      return sum + 1;
    }
    return sum;
  }, 0);

  var contd = false;

  for (let i = 0; i < teamMatchStats.length; i++) {
    if (isNaN(teamMatchStats[i].teamStats[dataPoint])) {
      contd = true;
      break;
    }
  }

  var matchesInCompOpp = 0;
  if (matchesInComp === 0) {
    console.log(
      "No matches found in the current competition!\n ERROR: this really shouldnt happen by the way i wrote the code, probably big bug, line 187"
    );
    return `womp womp`;
  }

  let oppTeamsThatHaveData = 3;

  var inputs = [
    teamMatchStats.reduce((sum, val) => sum + val.teamStats[dataPoint], 0) /
      teamMatchStats.length,
    teamMatchStats.reduce((sum, val) => {
      if (val.comp === teamMatchStats[teamMatchStats.length - 1].comp) {
        return sum + val.teamStats[dataPoint];
      }
      return sum;
    }, 0) / matchesInComp,
    teamMatchStats
      .slice(-3)
      .reduce(
        (last, val) =>
          last > val.teamStats[dataPoint] ? last : val.teamStats[dataPoint],
        0
      ),
    teamMatchStats[teamMatchStats.length - 1].teamStats[dataPoint],
    (oppTeams.reduce((sum, val) => {
      if (!oppTeamOppMatchStats[val] || val == 0) {
        oppTeamsThatHaveData--;
        if (oppTeamsThatHaveData === 0) {
          oppTeamsThatHaveData = 9;
          return (
            teamMatchStats.reduce(
              (sum, val) => sum + val.teamStats[dataPoint],
              0
            ) / teamMatchStats.length
          );
        }
        return sum;
      }
      return (
        sum +
        oppTeamOppMatchStats[+val].reduce(
          (sum, val) => sum + val.oppStats[dataPoint],
          0
        ) /
          oppTeamOppMatchStats[+val].length
      );
    }, 0) *
      oppTeamsThatHaveData) /
      3,
    (oppTeams.reduce((sum, val) => {
      oppTeamsThatHaveDataComp = oppTeamsThatHaveData;
      if (oppTeamsThatHaveData === 9) {
        return (
          teamMatchStats.reduce((sum, val) => {
            if (val.comp === teamMatchStats[teamMatchStats.length - 1].comp) {
              return sum + val.teamStats[dataPoint];
            }
            return sum;
          }, 0) / matchesInComp
        );
      }
      const ret =
        oppTeamOppMatchStats[+val] && val != 0
          ? oppTeamOppMatchStats[+val].reduce((sum, val) => {
              if (val.comp === teamMatchStats[teamMatchStats.length - 1].comp) {
                matchesInCompOpp++;
                return sum + val.oppStats[dataPoint];
              }
              return sum;
            }, 0)
          : 0;
      if (!oppTeamOppMatchStats[+val] || val == 0 || matchesInCompOpp == 0) {
        oppTeamsThatHaveDataComp--;
        return sum;
      }
      return sum + ret / matchesInCompOpp;
    }, 0) *
      oppTeamsThatHaveDataComp) /
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

async function testMatchPredictions() {
  const dataPoint = predictionMode;
  let matchData = [];
  let avgError = [];
  let correctPreds = 0;
  for (let y = 0; y < 10000; y++) {
    matchData.push([]);
  }
  // all matches in year
  for (let i = 0; i < allMatchesInYear.length; i++) {
    // if score breakdown is a nan or nonexistent
    if (!allMatchesInYear[i].score_breakdown) {
      continue;
    }
    let contd = false;
    for (let j = 0; j < subDataPoints.length; j++) {
      if (
        isNaN(allMatchesInYear[i].score_breakdown.red[subDataPoints[j]]) ||
        isNaN(allMatchesInYear[i].score_breakdown.blue[subDataPoints[j]])
      ) {
        contd = true;
        break;
      }
    }
    for (let j = 0; j < 3; j++) {
      if (
        !allMatchesInYear[i].alliances.red.team_keys[j] ||
        !allMatchesInYear[i].alliances.blue.team_keys[j] ||
        !matchData[
          parseInt(allMatchesInYear[i].alliances.red.team_keys[j].substring(3))
        ] ||
        !matchData[
          parseInt(allMatchesInYear[i].alliances.blue.team_keys[j].substring(3))
        ]
      ) {
        contd = true;
        break;
      }
    }
    if (contd) {
      continue;
    }
    let redAvgArr = [];
    let redAvg = 0;
    let blueAvgArr = [];
    let blueAvg = 0;
    for (
      let j = 0;
      j < allMatchesInYear[i].alliances.red.team_keys.length;
      j++
    ) {
      // all teams should have data, get team
      let team = allMatchesInYear[i].alliances.red.team_keys[j];
      team = parseInt(team.substring(3));
      // get prediction
      const pred = await predictData(
        dataPoint,
        team,
        allMatchesInYear[i].alliances.blue.team_keys,
        matchData[team],
        allMatchesInYear[i].alliances.blue.team_keys
          .map((val) => matchData[parseInt(val.substring(3))])
          .flat(Infinity)
      );
      if (!(typeof pred == "string")) {
        redAvgArr.push(pred);
      }

      // add the match data after
      matchData[team].push({
        teamStats: allMatchesInYear[i].score_breakdown.red,
        oppTeams: allMatchesInYear[i].alliances.blue.team_keys,
        oppStats: allMatchesInYear[i].score_breakdown.blue,
        comp: allMatchesInYear[i].key,
        time: allMatchesInYear[i].actual_time,
      });
    }
    // add it to the avg error
    if (redAvgArr.length > 0) {
      redAvg = redAvgArr.reduce((sum, val) => sum + val, 0) / redAvgArr.length;
      avgError.push(Math.abs(redAvg - allMatchesInYear[i].alliances.red.score));
    }

    for (
      let j = 0;
      j < allMatchesInYear[i].alliances.blue.team_keys.length;
      j++
    ) {
      // repeat for blue, getting team
      let team = allMatchesInYear[i].alliances.blue.team_keys[j];
      team = parseInt(team.substring(3));

      // getting pred
      const pred = await predictData(
        dataPoint,
        team,
        allMatchesInYear[i].alliances.red.team_keys,
        matchData[team],
        allMatchesInYear[i].alliances.red.team_keys
          .map((val) => matchData[parseInt(val.substring(3))])
          .flat(Infinity)
      );
      if (!(typeof pred == "string")) {
        blueAvgArr.push(pred);
      }

      matchData[team].push({
        teamStats: allMatchesInYear[i].score_breakdown.blue,
        oppTeams: allMatchesInYear[i].alliances.red.team_keys,
        oppStats: allMatchesInYear[i].score_breakdown.red,
        comp: allMatchesInYear[i].key,
        time: allMatchesInYear[i].actual_time,
      });
    }

    if (blueAvgArr.length > 0) {
      blueAvg =
        blueAvgArr.reduce((sum, val) => sum + val, 0) / blueAvgArr.length;
      avgError.push(
        Math.abs(blueAvg - allMatchesInYear[i].alliances.blue.score)
      );
    }
    if (
      (blueAvgArr.length > 0 &&
        redAvgArr.length > 0 &&
        blueAvg > redAvg &&
        allMatchesInYear[i].alliances.blue.score >
          allMatchesInYear[i].alliances.red.score) ||
      (blueAvg < redAvg &&
        allMatchesInYear[i].alliances.blue.score <
          allMatchesInYear[i].alliances.red.score)
    ) {
      correctPreds++;
    }
    if (avgError.length != 0) {
      const error =
        avgError.reduce((val, sum) => val + sum, 0) / avgError.length;
      deleteLastConsoleLine();
      console.log(`Average error of model: ${error.toFixed(3)}`);
    }
  }
  const squaredAvgError = avgError.map((val) => {
    return val ** 2;
  });

  const variance =
    squaredAvgError.reduce((sum, val) => sum + val, 0) / avgError.length;

  const standardDev = Math.sqrt(variance);

  console.log(`Standard deviation of model: ${standardDev.toFixed(3)}`);
  console.log(
    `Percentage correct predictions: ${correctPreds / (avgError.length / 2)}`
  );
}

async function main() {
  const year = await askUserQuestion("Enter the year to predict for:");
  allMatchesInYear = await getDataFromFile(`matches${year}.json`);
  allMathcesInYear = await allMatchesInYear.sort(
    (a, b) => a.actual_time - b.actual_time
  );
  trainedNumbers = await getDataFromFile(`trainedNumbers${year}.json`);

  const red1 = await askUserQuestion("Enter red 1:");
  if (red1 == "test") {
    await testMatchPredictions();
    return;
  }

  const red2 = await askUserQuestion("Enter red 2:");
  const red3 = await askUserQuestion("Enter red 3:");
  const blue1 = await askUserQuestion("Enter blue 1:");
  const blue2 = await askUserQuestion("Enter blue 2:");
  const blue3 = await askUserQuestion("Enter blue 3:");

  const dataPoint = predictionMode;

  const redTeams = [red1, red2, red3];
  const blueTeams = [blue1, blue2, blue3];

  const [red1Data, oppRed1Data] = await getTeamData(red1, blueTeams, year);
  const [red2Data, oppRed2Data] = await getTeamData(red2, blueTeams, year);
  const [red3Data, oppRed3Data] = await getTeamData(red3, blueTeams, year);
  const red1pred = await predictData(
    dataPoint,
    red1,
    blueTeams,
    red1Data,
    oppRed1Data
  );
  const red2pred = await predictData(
    dataPoint,
    red2,
    blueTeams,
    red2Data,
    oppRed2Data
  );
  const red3pred = await predictData(
    dataPoint,
    red3,
    blueTeams,
    red3Data,
    oppRed3Data
  );
  const [blue1Data, oppBlue1Data] = await getTeamData(blue1, redTeams, year);
  const [blue2Data, oppBlue2Data] = await getTeamData(blue2, redTeams, year);
  const [blue3Data, oppBlue3Data] = await getTeamData(blue3, redTeams, year);
  const blue1pred = await predictData(
    dataPoint,
    blue1,
    redTeams,
    blue1Data,
    oppBlue1Data
  );
  const blue2pred = await predictData(
    dataPoint,
    blue2,
    redTeams,
    blue2Data,
    oppBlue2Data
  );
  const blue3pred = await predictData(
    dataPoint,
    blue3,
    redTeams,
    blue3Data,
    oppBlue3Data
  );

  const redScore = (red1pred + red2pred + red3pred) / 3;
  const blueScore = (blue1pred + blue2pred + blue3pred) / 3;

  console.log(
    `Predicted match scores: Red Alliance: ${redScore.toFixed(
      3
    )}, Blue Alliance: ${blueScore.toFixed(3)}`
  );
  console.log(
    `Predicted winner: ${redScore > blueScore ? "Red" : "Blue"} Alliance!`
  );
}

main();
