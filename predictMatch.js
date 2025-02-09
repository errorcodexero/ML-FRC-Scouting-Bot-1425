const fs = require("fs").promises;
const readline = require("readline");
const axios = require("axios");

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

  fullTeamData = await getTBAData(`/team/${teamKey}/matches/${year}`);

  fullTeamData = await fullTeamData.sort(
    (a, b) => a.actual_time < b.actual_time
  );

  const teamData = await fullTeamData.filter(
    (val) => val.actual_time < Date.now()
  );

  for (let i = 0; i < teamData.length; i++) {
    let contd = false;
    for (let j = 0; j < subDataPoints.length; j++) {
      if (!teamData[i].score_breakdown[subDataPoints[j]]) {
        contd = true;
        break;
      }
    }
    if (!teamData[i].score_breakdown || contd) {
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
      for (let k = 0; k < subDataPoints.length; k++) {
        if (!oppTeamData[j].score_breakdown[subDataPoints[k]]) {
          contd = true;
          break;
        }
      }
      if (!oppTeamData[j].score_breakdown || contd) {
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

  if (teamMatchStats.length == 0) {
    console.log("No matches found!");
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
          oppTeamsThatHaveData = 2.9999;
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
      if (oppTeamsThatHaveData === 2.9999) {
        return (
          teamMatchStats.reduce((sum, val) => {
            if (val.comp === teamMatchStats[teamMatchStats.length - 1].comp) {
              return sum + val.teamStats[dataPoint];
            }
            return sum;
          }, 0) /
          (matchesInComp * 3)
        );
      }
      return oppTeamOppMatchStats[+val] && val != 0
        ? sum +
            oppTeamOppMatchStats[+val].reduce((sum, val) => {
              if (val.comp === teamMatchStats[teamMatchStats.length - 1].comp) {
                matchesInCompOpp++;
                return sum + val.oppStats[dataPoint];
              }
              return sum;
            }, 0) /
              matchesInCompOpp +
            0.000001
        : sum;
    }, 0) *
      oppTeamsThatHaveData) /
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
  const red1 = await askUserQuestion("Enter red 1:");
  const red2 = await askUserQuestion("Enter red 2:");
  const red3 = await askUserQuestion("Enter red 3:");
  const blue1 = await askUserQuestion("Enter blue 1:");
  const blue2 = await askUserQuestion("Enter blue 2:");
  const blue3 = await askUserQuestion("Enter blue 3:");

  const year = await askUserQuestion("Enter the year to predict for:");
  const dataPoint = "match";

  trainedNumbers = await getDataFromFile(`trainedNumbers${year}.json`);

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
