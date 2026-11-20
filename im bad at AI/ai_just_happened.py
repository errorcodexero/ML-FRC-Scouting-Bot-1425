# in more ways than one

import json
import math
import random
from copy import deepcopy
from collections import deque
from itertools import groupby
from pathlib import Path

YEAR = 2026

# both scale 
# first row of node length
node_height_1 = 8

# second row of node length
node_height_2 = 8

training_flux = 0.01  # Finite-difference probe size, in normalized score units.


training_diff = 0.9

# passes through the whole dataset
iters_before_trained = 80

# Random initialization avoids giving every hidden neuron identical weights.
random.seed(2026)  # Keep the initial model reproducible.

# error should scale immensely, so it should be pretty small. 
# change this first
diff_multiplier = 0.001  # Smaller learning rate for finite-difference updates.
MAX_GRADIENT = 1.0  # Bound noisy single-example coordinate gradients.
FEATURE_SCALE = 500.0  # Keep team-average inputs near a moderate numeric range.
RECENT_MATCH_COUNT = 3
EARLY_STOPPING_WINDOW = 10



input_length = 6  # Season, event, and recent-event own/opponent averages.
output_length = 1  # One shared prediction for either alliance color.
LEAKY_RELU_SLOPE = 0.1


def activate(value):
    """Leaky ReLU keeps a gradient when a hidden node is below zero."""
    return value if value > 0 else LEAKY_RELU_SLOPE * value

weight_being_trained = 0

weight_group_1 = []
weight_group_2 = []
weight_group_3 = []
weight_node_group_1 = []
weight_node_group_2 = []
weight_node_group_3 = [0.0 for _ in range(output_length)]

for i in range(node_height_1):
    weight_group_1.append([])
    weight_node_group_1.append(0.0)
    for j in range(input_length):
        weight_group_1[i].append(random.gauss(0.0, math.sqrt(2.0 / input_length)))

for i in range(node_height_2):
    weight_group_2.append([])
    weight_node_group_2.append(0.0)
    for j in range(node_height_1):
        weight_group_2[i].append(random.gauss(0.0, math.sqrt(2.0 / node_height_1)))

for i in range(output_length):
    weight_group_3.append([])
    for j in range(node_height_2):
        weight_group_3[i].append(random.gauss(0.0, math.sqrt(1.0 / node_height_2)))

def load_matches_from_json(filename=f"tba_matches_{YEAR}.json"):
	"""Load every match from a TBA JSON file into a Python list (array)."""
	path = Path(filename)
	with path.open("r", encoding="utf-8") as file:
		matches = json.load(file)

	if not isinstance(matches, list):
		raise ValueError(f"Expected a JSON array of matches in {path}")

	return matches

print("loading all matches...")
all_matches = load_matches_from_json()

def get_pred_match_score(entries):
    if len(entries) != input_length:
        raise ValueError(f"Expected {input_length} match features, got {len(entries)}.")

    node_group_1 = []
    node_group_2 = []
    output = weight_node_group_3.copy()

    for i in range(node_height_1):
        node_group_1.append(0.0)
    
    for i in range(node_height_2):
        node_group_2.append(0.0)

    for i in range(node_height_1):
        for j, entry in enumerate(entries):
            node_group_1[i] += (entry * weight_group_1[i][j])
        node_group_1[i] += weight_node_group_1[i]
        node_group_1[i] = activate(node_group_1[i])
        
    
    for i in range(node_height_2):
        for j, node in enumerate(node_group_1):
            node_group_2[i] += (node * weight_group_2[i][j])
        node_group_2[i] += weight_node_group_2[i]
        node_group_2[i] = activate(node_group_2[i])
    
    for i in range(len(output)):
        for j, node in enumerate(node_group_2):
            output[i] += (node * weight_group_3[i][j])

    return output


def change_weight(change, weight_num):
    """Change one scalar parameter using a flat, zero-based parameter index."""
    if not 0 <= weight_num < number_of_weights:
        raise IndexError(f"Weight index {weight_num} is out of range (0-{number_of_weights - 1}).")

    remaining = weight_num
    for group in (weight_group_1, weight_group_2, weight_group_3):
        for row in group:
            if remaining < len(row):
                row[remaining] += change
                return
            remaining -= len(row)

    for group in (weight_node_group_1, weight_node_group_2, weight_node_group_3):
        if remaining < len(group):
            group[remaining] += change
            return
        remaining -= len(group)


number_of_weights = (
    sum(len(row) for group in (weight_group_1, weight_group_2, weight_group_3) for row in group)
    + len(weight_node_group_1)
    + len(weight_node_group_2)
    + len(weight_node_group_3)
)


def build_training_examples(matches):
    """Build pre-match features without using results from simultaneous matches."""
    history = {}
    event_history = {}
    event_totals = {}
    examples = []
    completed = []
    for match in matches:
        alliances = match.get("alliances", {})
        red = alliances.get("red", {})
        blue = alliances.get("blue", {})
        # Actual time is closest to when the score became known; use scheduled
        # time only for records where TBA has no actual_time.
        match_time = match.get("actual_time") or match.get("time")
        if (isinstance(match_time, (int, float))
                and red.get("score") is not None and blue.get("score") is not None):
            completed.append((match_time, match))
    completed.sort(key=lambda item: item[0])

    for _, simultaneous_matches in groupby(completed, key=lambda item: item[0]):
        # Don't allow any match at the same timestamp to influence another's
        # features. Collect their score updates and apply them as a batch.
        updates = []
        for _, match in simultaneous_matches:
            red = match["alliances"]["red"]
            blue = match["alliances"]["blue"]
            red_teams = red.get("team_keys", [])
            blue_teams = blue.get("team_keys", [])
            if len(red_teams) != 3 or len(blue_teams) != 3:
                continue

            for alliance_teams, own_score, opponent_score in (
                (red_teams, red["score"], blue["score"]),
                (blue_teams, blue["score"], red["score"]),
            ):
                own_averages = []
                opponent_averages = []
                event_own_averages = []
                event_opponent_averages = []
                recent_own_averages = []
                recent_opponent_averages = []
                event_key = match.get("event_key")
                for team in alliance_teams:
                    own_total, opponent_total, count = history.get(team, (0.0, 0.0, 0))
                    if count:
                        own_averages.append(own_total / count)
                        opponent_averages.append(opponent_total / count)
                    else:
                        # Preserve the prior no-history convention for rookies.
                        own_averages.append(0.0)
                        opponent_averages.append(0.0)
                    event_own_total, event_opponent_total, event_count = event_totals.get(
                        (event_key, team), (0.0, 0.0, 0)
                    )
                    if event_count:
                        event_own_averages.append(event_own_total / event_count)
                        event_opponent_averages.append(event_opponent_total / event_count)
                    else:
                        event_own_averages.append(0.0)
                        event_opponent_averages.append(0.0)
                    recent = list(event_history.get((event_key, team), ()))[-RECENT_MATCH_COUNT:]
                    if recent:
                        recent_own_averages.append(sum(item[0] for item in recent) / len(recent))
                        recent_opponent_averages.append(sum(item[1] for item in recent) / len(recent))
                    else:
                        recent_own_averages.append(0.0)
                        recent_opponent_averages.append(0.0)
                entries = [
                    sum(own_averages) / len(own_averages) / FEATURE_SCALE,
                    sum(opponent_averages) / len(opponent_averages) / FEATURE_SCALE,
                    sum(event_own_averages) / len(event_own_averages) / FEATURE_SCALE,
                    sum(event_opponent_averages) / len(event_opponent_averages) / FEATURE_SCALE,
                    sum(recent_own_averages) / len(recent_own_averages) / FEATURE_SCALE,
                    sum(recent_opponent_averages) / len(recent_opponent_averages) / FEATURE_SCALE,
                ]
                examples.append((entries, [own_score / 100.0]))

            event_key = match.get("event_key")
            updates.extend((team, red["score"], blue["score"], event_key) for team in red_teams)
            updates.extend((team, blue["score"], red["score"], event_key) for team in blue_teams)

        for team, own_score, opponent_score, event_key in updates:
            own_total, opponent_total, count = history.get(team, (0.0, 0.0, 0))
            history[team] = (own_total + own_score, opponent_total + opponent_score, count + 1)
            if event_key is not None:
                event_key_and_team = (event_key, team)
                event_own_total, event_opponent_total, event_count = event_totals.get(
                    event_key_and_team, (0.0, 0.0, 0)
                )
                event_totals[event_key_and_team] = (
                    event_own_total + own_score,
                    event_opponent_total + opponent_score,
                    event_count + 1,
                )
                if event_key_and_team not in event_history:
                    event_history[event_key_and_team] = deque(maxlen=RECENT_MATCH_COUNT)
                event_history[event_key_and_team].append((own_score, opponent_score))

    return examples


def match_loss(prediction, actual):
    """Mean squared score error; inputs and targets are scaled by 100."""
    errors = [prediction[i] - actual[i] for i in range(output_length)]
    if any(not math.isfinite(error) or abs(error) > 1e100 for error in errors):
        raise FloatingPointError(
            "Model outputs diverged. Reduce diff_multiplier or inspect the training inputs."
        )
    return sum(error ** 2 for error in errors) / output_length


def mean_loss(examples):
    """Measure loss with one fixed set of model weights."""
    return sum(
        match_loss(get_pred_match_score(entries), actual)
        for entries, actual in examples
    ) / len(examples)


def evaluate(examples):
    if not examples:
        return None
    total_absolute_error = 0.0
    score_count = 0
    for entries, actual in examples:
        prediction = get_pred_match_score(entries)
        total_absolute_error += sum(
            abs(prediction[i] - actual[i]) * 100.0 for i in range(output_length)
        )
        score_count += output_length
    return total_absolute_error / score_count


training_examples = build_training_examples(all_matches)
if len(training_examples) < 2:
    raise SystemExit("Need at least two completed, timestamped matches to train and validate.")

# Keep the newest portion out of training for a chronological validation set.
split_index = int(len(training_examples) * 0.8)
# Each match contributes consecutive red and blue examples. Keep both sides of
# a match in the same split so validation never includes a training target.
split_index = max(2, split_index - split_index % 2)
if split_index >= len(training_examples):
    split_index = len(training_examples) - 2
train_examples = training_examples[:split_index]
validation_examples = training_examples[split_index:]
if not validation_examples:
    validation_examples = train_examples[-1:]
    train_examples = train_examples[:-1]

print(f"Training on {len(train_examples)} matches; validating on {len(validation_examples)}.")
baseline_score = sum(actual[0] for _, actual in train_examples) / len(train_examples)
baseline_mae = sum(
    abs(actual[0] - baseline_score) * 100.0
    for _, actual in validation_examples
) / len(validation_examples)

parameter_groups = (
    weight_group_1,
    weight_group_2,
    weight_group_3,
    weight_node_group_1,
    weight_node_group_2,
    weight_node_group_3,
)
validation_history = []
best_validation_mae = float("inf")
best_parameters = None

for epoch in range(iters_before_trained):
    random.shuffle(train_examples)
    for entries, actual in train_examples:
        # Probe one individual parameter on each example, estimate its loss
        # gradient, restore it, then apply a small step toward lower loss.
        parameter_index = weight_being_trained
        change_weight(training_flux, parameter_index)
        plus_loss = match_loss(get_pred_match_score(entries), actual)

        change_weight(-2 * training_flux, parameter_index)
        minus_loss = match_loss(get_pred_match_score(entries), actual)

        change_weight(training_flux, parameter_index)
        gradient = (plus_loss - minus_loss) / (2 * training_flux)
        gradient = max(-MAX_GRADIENT, min(MAX_GRADIENT, gradient))
        change_weight(-diff_multiplier * gradient, parameter_index)
        weight_being_trained = (weight_being_trained + 1) % number_of_weights

    # Keep a minimum probe size so late-epoch finite differences don't vanish.
    training_flux = max(training_flux * training_diff, 0.001)
    current_validation_mae = evaluate(validation_examples)
    if current_validation_mae < best_validation_mae:
        best_validation_mae = current_validation_mae
        best_parameters = deepcopy(parameter_groups)

    print(
        f"Epoch {epoch + 1}/{iters_before_trained}: "
        f"train loss {mean_loss(train_examples):.4f}, "
        f"validation MAE {current_validation_mae:.1f} points/alliance"
    )

    # Compare against the previous five epochs. If this epoch is no better
    # than their average, stop and restore the best validation checkpoint.
    if (len(validation_history) >= EARLY_STOPPING_WINDOW
            and sum(validation_history[-EARLY_STOPPING_WINDOW:]) / EARLY_STOPPING_WINDOW
            <= current_validation_mae):
        print(
            f"Early stopping: current validation MAE ({current_validation_mae:.1f}) "
            f"is not below the previous-{EARLY_STOPPING_WINDOW}-epoch average."
        )
        for current_group, saved_group in zip(parameter_groups, best_parameters):
            current_group[:] = saved_group
        break

    validation_history.append(current_validation_mae)

print(f"Best validation MAE: {best_validation_mae:.1f} points per alliance")
print(f"Baseline validation MAE: {baseline_mae:.1f} points per alliance")


def save_weights_to_json(filename=f"weights_{YEAR}.json"):
    """Save all network weights and node biases to a year-specific JSON file."""
    weights = {
        "year": YEAR,
        "activation": "leaky_relu",
        "activation_slope": LEAKY_RELU_SLOPE,
        "feature_scale": FEATURE_SCALE,
        "recent_match_count": RECENT_MATCH_COUNT,
        "input_length": input_length,
        "output_length": output_length,
        "weight_group_1": weight_group_1,
        "weight_group_2": weight_group_2,
        "weight_group_3": weight_group_3,
        "weight_node_group_1": weight_node_group_1,
        "weight_node_group_2": weight_node_group_2,
        "weight_node_group_3": weight_node_group_3,
    }
    with open(filename, "w", encoding="utf-8") as file:
        json.dump(weights, file, indent=2)


save_weights_to_json()



