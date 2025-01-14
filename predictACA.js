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

async function getTeamData(teamNumber, oppTeams) {
  var teamKey = String(teamNumber);
  if (!teamKey.includes("frc")) {
    teamKey = "frc" + teamNumber;
  }

  const year = await askUserQuestion("What year do you want to predict for?");

  fullTeamData = await getTBAData(`/team/${teamKey}/matches/${year}`);

  fullTeamData = await fullTeamData.sort(
    (a, b) => a.actual_time < b.actual_time
  );

  const teamData = await fullTeamData.filter(
    (val) => val.actual_time < Date.now()
  );

  for (let i = 0; i < teamData.length; i++) {
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
      if (oppTeamData[j].alliances.red.team_keys.includes(oppTeams[i])) {
        oppTeamMatchStats[oppTeams[i]].push({
          teamStats: oppTeamData[j].score_breakdown.red,
          comp: oppTeamData[j].key,
          time: oppTeamData[j].actual_time,
        });
      } else {
        oppTeamMatchStats[oppTeams[i]].push({
          teamStats: oppTeamData[j].score_breakdown.blue,
          comp: oppTeamData[j].key,
          time: oppTeamData[j].actual_time,
        });
      }
    }
  }
}

async function predictData(dataPoint, oppTeams) {
  if (!subDataPoints.includes(dataPoint)) {
    if (dataPoint.includes("auto")) {
      let ret = 0;
      for (let i = 0; i < subDataPoints.length; i++) {
        if (subDataPoints[i].includes("auto")) {
          ret += await predictData(subDataPoints[i], oppTeams);
        }
      }
      return ret;
    } else if (dataPoint.includes("teleop")) {
      let ret = 0;
      for (let i = 0; i < subDataPoints.length; i++) {
        if (subDataPoints[i].includes("teleop")) {
          ret += await predictData(subDataPoints[i], oppTeams);
        }
      }
      return ret;
    } else if (dataPoint.includes("endgame")) {
      let ret = 0;
      for (let i = 0; i < subDataPoints.length; i++) {
        if (subDataPoints[i].includes("endgame")) {
          ret += await predictData(subDataPoints[i], oppTeams);
        }
      }
      return ret;
    } else {
      let ret = 0;
      for (let i = 0; i < subDataPoints.length; i++) {
        ret += await predictData(subDataPoints[i], oppTeams);
      }
      return ret;
    }
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
      ) / 3,
    teamMatchStats[teamMatchStats.length - 1].teamStats[dataPoint],
    (oppTeams.reduce((sum, val) => {
      if (!oppTeamMatchStats[val] || val == 0) {
        oppTeamsThatHaveData--;
        return sum;
      }
      return (
        sum +
        oppTeamMatchStats[+val].reduce(
          (sum, val) => sum + val.teamStats[dataPoint],
          0
        ) /
          oppTeamMatchStats[+val].length
      );
    }, 0) *
      (1 + oppTeamsThatHaveData)) /
      3,
    (oppTeams.reduce(
      (sum, val) =>
        oppTeamMatchStats[+val] && val != 0
          ? sum +
            oppTeamMatchStats[+val].reduce((sum, val) => {
              if (val.comp === teamMatchStats[j].comp) {
                matchesInCompOpp++;
                return sum + val.teamStats[dataPoint];
              }
              return sum;
            }, 0) /
              oppTeamMatchStats[+val].length
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
  trainedNumbers = await getDataFromFile("trainedNumbers.json");
  const teamNumber = await askUserQuestion("Enter your team number: ");
  const oppTeams = [
    await askUserQuestion("Enter opposing team 1 (0 to skip): "),
    await askUserQuestion("Enter opposing team 2:"),
    await askUserQuestion("Enter opposing team 3:"),
  ];
  for (let i = 0; i < oppTeams.length; i++) {
    oppTeams[i] = +oppTeams[i];
    if (!Number.isInteger(oppTeams[i]) || oppTeams[i] < 1) {
      oppTeams[i] = 0;
    }
  }

  const dataPoint = await askUserQuestion("Enter the data point to predict: ");

  await getTeamData(teamNumber, oppTeams);

  let pred = await predictData(dataPoint, oppTeams);

  console.log(`Predicted ${dataPoint} for team ${teamNumber}: ${pred}`);
}

main();
