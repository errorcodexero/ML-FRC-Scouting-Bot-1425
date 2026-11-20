import json
from pathlib import Path

YEAR = 2026
LEAKY_RELU_SLOPE = 0.1
FEATURE_SCALE = 500.0
RECENT_MATCH_COUNT = 3
INPUT_LENGTH = 6
OUTPUT_LENGTH = 1
BASE_DIR = Path(__file__).resolve().parent
MATCHES_FILE = BASE_DIR / f"tba_matches_{YEAR}.json"
WEIGHTS_FILE = BASE_DIR / f"weights_{YEAR}.json"

# Optionally set this to a Unix timestamp to use only match results known before
# a particular time. Leave as None to use all completed matches in the JSON file.
CUTOFF_TIME = None


def load_json(filename):
    with filename.open("r", encoding="utf-8") as file:
        return json.load(file)


def normalize_team_key(team):
    team_key = str(team).strip().lower()
    if team_key.isdigit():
        team_key = f"frc{team_key}"
    if not team_key.startswith("frc") or not team_key[3:].isdigit():
        raise ValueError(f"Invalid team key {team!r}; use a team number or a key like 'frc254'.")
    return team_key


def get_team_stats(team_key, matches, cutoff_time=None):
    """Average this team's and its opponents' completed alliance scores."""
    own_total = 0
    opponent_total = 0
    match_count = 0

    for match in matches:
        alliances = match.get("alliances", {})
        red = alliances.get("red", {})
        blue = alliances.get("blue", {})
        red_score = red.get("score")
        blue_score = blue.get("score")
        if red_score is None or blue_score is None:
            continue

        if cutoff_time is not None:
            match_time = match.get("actual_time") or match.get("time")
            if not isinstance(match_time, (int, float)) or match_time >= cutoff_time:
                continue

        if team_key in red.get("team_keys", []):
            own_total += red_score
            opponent_total += blue_score
        elif team_key in blue.get("team_keys", []):
            own_total += blue_score
            opponent_total += red_score
        else:
            continue
        match_count += 1

    if match_count == 0:
        return 0.0, 0.0, 0
    return own_total / match_count, opponent_total / match_count, match_count


def get_latest_team_event(team_key, matches, cutoff_time=None):
    """Return the event key for this team's most recent completed match."""
    latest = None
    for match in matches:
        event_key = match.get("event_key")
        alliances = match.get("alliances", {})
        red = alliances.get("red", {})
        blue = alliances.get("blue", {})
        if not event_key or red.get("score") is None or blue.get("score") is None:
            continue
        if (team_key not in red.get("team_keys", [])
                and team_key not in blue.get("team_keys", [])):
            continue

        match_time = match.get("actual_time") or match.get("time")
        if not isinstance(match_time, (int, float)):
            continue
        if cutoff_time is not None and match_time >= cutoff_time:
            continue
        if latest is None or match_time > latest[0]:
            latest = (match_time, event_key)

    return latest[1] if latest else None


def get_event_stats(team_key, event_key, matches, cutoff_time=None):
    """Average this team's own/opponent scores across its completed event matches."""
    own_total = 0
    opponent_total = 0
    match_count = 0
    for match in matches:
        if match.get("event_key") != event_key:
            continue
        alliances = match.get("alliances", {})
        red = alliances.get("red", {})
        blue = alliances.get("blue", {})
        red_score = red.get("score")
        blue_score = blue.get("score")
        if red_score is None or blue_score is None:
            continue

        match_time = match.get("actual_time") or match.get("time")
        if not isinstance(match_time, (int, float)):
            continue
        if cutoff_time is not None and match_time >= cutoff_time:
            continue

        if team_key in red.get("team_keys", []):
            own_total += red_score
            opponent_total += blue_score
        elif team_key in blue.get("team_keys", []):
            own_total += blue_score
            opponent_total += red_score
        else:
            continue
        match_count += 1

    if not match_count:
        return 0.0, 0.0, 0
    return own_total / match_count, opponent_total / match_count, match_count


def get_recent_event_stats(team_key, event_key, matches, cutoff_time=None):
    """Average this team's own/opponent scores from its last event matches."""
    team_matches = []
    for match in matches:
        if match.get("event_key") != event_key:
            continue
        alliances = match.get("alliances", {})
        red = alliances.get("red", {})
        blue = alliances.get("blue", {})
        red_score = red.get("score")
        blue_score = blue.get("score")
        if red_score is None or blue_score is None:
            continue

        match_time = match.get("actual_time") or match.get("time")
        if not isinstance(match_time, (int, float)):
            continue
        if cutoff_time is not None and match_time >= cutoff_time:
            continue

        if team_key in red.get("team_keys", []):
            team_matches.append((match_time, red_score, blue_score))
        elif team_key in blue.get("team_keys", []):
            team_matches.append((match_time, blue_score, red_score))

    team_matches.sort(key=lambda result: result[0])
    recent = team_matches[-RECENT_MATCH_COUNT:]
    if not recent:
        return 0.0, 0.0, 0
    own_average = sum(item[1] for item in recent) / len(recent)
    opponent_average = sum(item[2] for item in recent) / len(recent)
    return own_average, opponent_average, len(recent)


def predict_match_score(entries, weights):
    """Run the same two-Leaky-ReLU-hidden-layer network used during training."""
    if len(entries) != INPUT_LENGTH:
        raise ValueError(f"Expected {INPUT_LENGTH} input features, got {len(entries)}.")

    w1 = weights["weight_group_1"]
    b1 = weights["weight_node_group_1"]
    w2 = weights["weight_group_2"]
    b2 = weights["weight_node_group_2"]
    w3 = weights["weight_group_3"]
    b3 = weights["weight_node_group_3"]

    if (weights.get("activation") != "leaky_relu"
            or weights.get("activation_slope") != LEAKY_RELU_SLOPE
            or weights.get("feature_scale") != FEATURE_SCALE
            or weights.get("input_length") != INPUT_LENGTH
            or weights.get("output_length") != OUTPUT_LENGTH
            or weights.get("recent_match_count") != RECENT_MATCH_COUNT):
        raise ValueError("These weights use an older model configuration. Retrain probs_wont_train.py first.")

    if (len(w1) != len(b1)
            or any(len(row) != len(entries) for row in w1)
            or len(w2) != len(b2)
            or any(len(row) != len(w1) for row in w2)
            or len(w3) != len(b3)
            or any(len(row) != len(w2) for row in w3)):
        raise ValueError("Weights have incompatible dimensions; retrain the model or use matching weights.")

    hidden_1 = [
        _activate(sum(value * weight for value, weight in zip(entries, row)) + bias)
        for row, bias in zip(w1, b1)
    ]
    hidden_2 = [
        _activate(sum(value * weight for value, weight in zip(hidden_1, row)) + bias)
        for row, bias in zip(w2, b2)
    ]
    output = [
        sum(value * weight for value, weight in zip(hidden_2, row)) + bias
        for row, bias in zip(w3, b3)
    ]
    return output


def _activate(value):
    return value if value > 0 else LEAKY_RELU_SLOPE * value


def main():
    matches = load_json(MATCHES_FILE)
    weights = load_json(WEIGHTS_FILE)
    if weights.get("year") != YEAR:
        raise ValueError(f"Weights file is for {weights.get('year')}, expected {YEAR}.")

    red_teams = [normalize_team_key(input(f"Red team {i} key or number: ")) for i in range(1, 4)]
    blue_teams = [normalize_team_key(input(f"Blue team {i} key or number: ")) for i in range(1, 4)]

    # The same model scores either color. Features are this alliance's average
    # team score and average opponent score; alliance position/color is absent.
    alliance_entries = []
    for alliance_teams in (red_teams, blue_teams):
        team_stats = []
        for team in alliance_teams:
            season_own, season_opponent, season_games = get_team_stats(team, matches, CUTOFF_TIME)
            event_key = get_latest_team_event(team, matches, CUTOFF_TIME)
            event_own, event_opponent, event_games = get_event_stats(
                team, event_key, matches, CUTOFF_TIME
            )
            recent_own, recent_opponent, recent_games = get_recent_event_stats(
                team, event_key, matches, CUTOFF_TIME
            )
            if season_games == 0:
                print(f"Warning: no completed matches found for {team}; using zero season averages.")
            if event_key is None or recent_games == 0:
                print(f"Warning: no recent event results found for {team}; using zero recent averages.")
            team_stats.append((
                season_own, season_opponent,
                event_own, event_opponent,
                recent_own, recent_opponent,
            ))
        alliance_entries.append((
            sum(stats[0] for stats in team_stats) / len(team_stats) / FEATURE_SCALE,
            sum(stats[1] for stats in team_stats) / len(team_stats) / FEATURE_SCALE,
            sum(stats[2] for stats in team_stats) / len(team_stats) / FEATURE_SCALE,
            sum(stats[3] for stats in team_stats) / len(team_stats) / FEATURE_SCALE,
            sum(stats[4] for stats in team_stats) / len(team_stats) / FEATURE_SCALE,
            sum(stats[5] for stats in team_stats) / len(team_stats) / FEATURE_SCALE,
        ))

    red_score = predict_match_score(alliance_entries[0], weights)[0]
    blue_score = predict_match_score(alliance_entries[1], weights)[0]
    print(f"Predicted Red score: {red_score * 100:.1f}")
    print(f"Predicted Blue score: {blue_score * 100:.1f}")


if __name__ == "__main__":
    main()
