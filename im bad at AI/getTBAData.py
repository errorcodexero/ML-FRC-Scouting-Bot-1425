import json
import os
import requests

API_KEY = os.getenv("TBA_API_KEY")
if not API_KEY:
    raise SystemExit("Missing TBA_API_KEY. Set it to your The Blue Alliance API key and run again.")

BASE_URL = "https://www.thebluealliance.com/api/v3"
YEAR = 2026  # Change this to retrieve matches from a different season.
TEAM_KEY = "frc254"  # Change this to the team you want to filter for.

headers = {
    "X-TBA-Auth-Key": API_KEY
}

def get_tba_data(endpoint):
    url = f"{BASE_URL}/{endpoint.lstrip('/')}"
    response = requests.get(url, headers=headers, timeout=30)
    if response.status_code == 401:
        raise SystemExit("The Blue Alliance rejected the API key (401). Check that TBA_API_KEY is valid.")
    response.raise_for_status()  # Raises an error for other bad status codes (404, etc.)
    return response.json()


def get_team_matches(team_key, all_matches):
    """Return this team's matches from the downloaded season matches."""
    if isinstance(team_key, int) or str(team_key).isdigit():
        team_key = f"frc{team_key}"

    return tuple(
        match for match in all_matches
        if any(
            team_key in match.get("alliances", {}).get(alliance, {}).get("team_keys", [])
            for alliance in ("red", "blue")
        )
    )

# Get info for the selected team.
team_data = get_tba_data(f"team/{TEAM_KEY}")
print(f"Team Name: {team_data['nickname']} | Location: {team_data['city']}, {team_data['state_prov']}")

# Get matches from every event in the selected year.
events = get_tba_data(f"events/{YEAR}")
matches = []
count = 0
for event in events:
    count += 1
    print(f"{count}/{len(events)}")
    matches.extend(get_tba_data(f"event/{event['key']}/matches/simple"))

print(f"Total matches pulled: {len(matches)}")
all_matches = tuple(matches)
team_matches = get_team_matches(TEAM_KEY, all_matches)
print(f"Matches played by {TEAM_KEY}: {len(team_matches)}")

# Save output to a local JSON file
with open(f"tba_matches_{YEAR}.json", "w") as f:
    json.dump(all_matches, f, indent=2)
