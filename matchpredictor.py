import math
import statbotics

sb = statbotics.Statbotics()

LEARNING_RATE0 = 0.0
LEARNING_RATE1 = 0.0000000000001
LEARNING_RATE2 = 0.0
H = 0.00000000000000001

INDIVIDUAL_DONE_THRESH = 0.8
DONE_THRESH = 0.00005

year = int(input("Enter year:\n"))

t1num = int(input("Enter red alliance team 1:\n"))
t2num = int(input("Enter red alliance team 2:\n"))
t3num = int(input("Enter red alliance team 3:\n"))

oppT1num = int(input("Enter blue alliance team 1:\n"))
oppT2num = int(input("Enter blue alliance team 2:\n"))
oppT3num = int(input("Enter blue alliance team 3:\n"))

def get_match_scores(team_num):
    if(team_num == 0):
        return [0, 0, 0]
    else:
        team_match_scores = []
        team_matches = sb.get_matches(team_num, year)
        for team_match in team_matches:
            if(team_match["blue_1"] == team_num or team_match["blue_2"] == team_num or team_match["blue_3"] == team_num):
                team_match_scores.append(team_match["blue_score"])
            else:
                team_match_scores.append(team_match["red_score"])
        return team_match_scores

def get_opp_match_scores(team_num):
    if(team_num == 0):
        return [0, 0, 0]
    else:
        opp_team_match_scores = []
        team_matches = sb.get_matches(team_num, year)
        for team_match in team_matches:
            if(team_match["blue_1"] == team_num or team_match["blue_2"] == team_num or team_match["blue_3"] == team_num):
                opp_team_match_scores.append(team_match["red_score"])
            else:
                opp_team_match_scores.append(team_match["blue_score"])
        return opp_team_match_scores

print("Getting red alliance data...")
t1match_scores = get_match_scores(t1num)
t2match_scores = get_match_scores(t2num)
t3match_scores = get_match_scores(t3num)

t1opp_match_scores = get_opp_match_scores(t1num)
t2opp_match_scores = get_opp_match_scores(t2num)
t3opp_match_scores = get_opp_match_scores(t3num)

print("Getting blue alliance data...")
oppT1opp_match_scores = get_opp_match_scores(oppT1num)
oppT2opp_match_scores = get_opp_match_scores(oppT2num)
oppT3opp_match_scores = get_opp_match_scores(oppT3num)

oppT1match_scores = get_match_scores(oppT1num)
oppT2match_scores = get_match_scores(oppT2num)
oppT3match_scores = get_match_scores(oppT3num)

teams_gotten = []

def get_test_matches(team):
    if(team == 0 or team in teams_gotten):
        return []
    teams_gotten.append(team)
    print(f"Getting some test matches for team {team}...")
    team_events = sb.get_team_events(team, year)

    matches = sb.get_matches(None, None, team_events[-1]["event"])

    if not (len(team_events) == 1):
        matches += sb.get_matches(None, None, team_events[-2]["event"])
    
    return matches[len(matches) - 101:]

def abs_avg(dict):
    ret = 0
    for i in dict:
        if(i != None):
            ret += abs(i)
    ret /= len(dict)
    return ret

training_matches = []
training_matches += get_test_matches(t1num)
training_matches += get_test_matches(t2num)
training_matches += get_test_matches(t3num)
training_matches += get_test_matches(oppT1num)
training_matches += get_test_matches(oppT2num)
training_matches += get_test_matches(oppT3num)

print("Initializing training set...")

team_match_scores = []
opp_team_match_scores = []

training_set = []

for i in range(10000):
    team_match_scores.append([])
    opp_team_match_scores.append([])

for match in training_matches :
    if(len(team_match_scores[match["blue_1"]]) > 0 and
       len(team_match_scores[match["blue_2"]]) > 0 and
       len(team_match_scores[match["blue_3"]]) > 0 and
       len(team_match_scores[match["red_1"]]) > 0 and
       len(team_match_scores[match["red_2"]]) > 0 and
       len(team_match_scores[match["red_3"]]) > 0 and
       match["blue_score"] != None):
        training_set.append({"inputs": [abs_avg(team_match_scores[match["blue_1"]]), 
                            team_match_scores[match["blue_1"]][-1],
                            abs_avg(team_match_scores[match["blue_2"]]),
                            team_match_scores[match["blue_2"]][-1],
                            abs_avg(team_match_scores[match["blue_3"]]), 
                            team_match_scores[match["blue_3"]][-1],
                            abs_avg(opp_team_match_scores[match["red_1"]]),
                            opp_team_match_scores[match["red_1"]][-1],
                            abs_avg(opp_team_match_scores[match["red_2"]]),
                            opp_team_match_scores[match["red_2"]][-1],
                            abs_avg(opp_team_match_scores[match["red_3"]]),
                            opp_team_match_scores[match["red_3"]][-1]],
                            "output": match["blue_score"]})
    if(len(team_match_scores[match["blue_1"]]) > 0 and
       len(team_match_scores[match["blue_2"]]) > 0 and
       len(team_match_scores[match["blue_3"]]) > 0 and
       len(team_match_scores[match["red_1"]]) > 0 and
       len(team_match_scores[match["red_2"]]) > 0 and
       len(team_match_scores[match["red_3"]]) > 0 and
       match["blue_score"] != None):
        training_set.append({"inputs": [abs_avg(team_match_scores[match["red_1"]]), 
                            team_match_scores[match["red_1"]][-1],
                            abs_avg(team_match_scores[match["red_2"]]),
                            team_match_scores[match["red_2"]][-1],
                            abs_avg(team_match_scores[match["red_3"]]), 
                            team_match_scores[match["red_3"]][-1],
                            abs_avg(opp_team_match_scores[match["blue_1"]]),
                            opp_team_match_scores[match["blue_1"]][-1],
                            abs_avg(opp_team_match_scores[match["blue_2"]]),
                            opp_team_match_scores[match["blue_2"]][-1],
                            abs_avg(opp_team_match_scores[match["blue_3"]]),
                            opp_team_match_scores[match["blue_3"]][-1]],
                            "output": match["red_score"]})
    if(match["blue_score"] != None):
        team_match_scores[match["blue_1"]].append(match["blue_score"])
        team_match_scores[match["blue_2"]].append(match["blue_score"])
        team_match_scores[match["blue_3"]].append(match["blue_score"])

        opp_team_match_scores[match["red_1"]].append(match["blue_score"])
        opp_team_match_scores[match["red_2"]].append(match["blue_score"])
        opp_team_match_scores[match["red_3"]].append(match["blue_score"])
    
    if(match["red_score"] != None):
        team_match_scores[match["red_1"]].append(match["red_score"])
        team_match_scores[match["red_2"]].append(match["red_score"])
        team_match_scores[match["red_3"]].append(match["red_score"])

        opp_team_match_scores[match["blue_1"]].append(match["red_score"])
        opp_team_match_scores[match["blue_2"]].append(match["red_score"])
        opp_team_match_scores[match["blue_3"]].append(match["red_score"])

print("Starting training...")

a = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
b = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
c = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
d = 1

def cubic_thing(x, which = ""):
    ret = 0
    for i in range(len(x)):
        if(which == f"a{i}"):
            ret += (a[i] + H) * x[i] ** 3
            ret += b[i] * x[i] ** 2
            ret += c[i] * x[i]
        elif(which == f"b{i}"):
            ret += a[i] * x[i] ** 3
            ret += (b[i] + H) * x[i] ** 2
            ret += c[i] * x[i]
        elif(which == f"c{i}"):
            ret += a[i] * x[i] ** 3
            ret += b[i] * x[i] ** 2
            ret += (c[i] + H) * x[i]
        else:
            ret += a[i] * x[i] ** 3
            ret += b[i] * x[i] ** 2
            ret += c[i] * x[i]
    
    if(which == "d"):
        ret += d + H
    else:
        ret += d
    
    return ret

def cost(which = ""):
    ret = 0
    for datum in training_set:
        ret += abs(cubic_thing(datum["inputs"], which) - datum["output"])
    ret /= len(training_set)
    return ret

da = []
db = []
dc = []
dd = INDIVIDUAL_DONE_THRESH + 1

for i in range(12):
    da.append(INDIVIDUAL_DONE_THRESH + 1)
    db.append(INDIVIDUAL_DONE_THRESH + 1)
    dc.append(INDIVIDUAL_DONE_THRESH + 1)

is_done = []
for i in range(37):
    is_done.append(False)

def percent_done():
    ret = 0
    for i in is_done:
        if i == True:
            ret += 1
    # ret /= len(is_done)
    # ret *= 100
    return ret

last_cost = 10000
counter = 0
done_next = False

while not done_next:
    counter += 1

    if percent_done() >= 37 or (last_cost - cost()) < DONE_THRESH or counter >= 1000:
        done_next = True
    else:
        done_next = False

    last_cost = cost()

    for i in range(len(da)):
        if(abs(da[i]) < INDIVIDUAL_DONE_THRESH):
            if(not is_done[i]):
                da[i] = (cost(f"a{i}") - cost()) / H
            is_done[i] = True
        if(not is_done[i]):
            da[i] = (cost(f"a{i}") - cost()) / H
        
        
        if(abs(db[i]) < INDIVIDUAL_DONE_THRESH):
            if(not is_done[i + 12]):
                db[i] = (cost(f"b{i}") - cost()) / H
            is_done[i + 12] = True
        if(not is_done[i + 12]):
            db[i] = (cost(f"b{i}") - cost()) / H

        if(abs(dc[i]) < INDIVIDUAL_DONE_THRESH):
            if(not is_done[i + 24]):
                dc[i] = (cost(f"c{i}") - cost()) / H
            is_done[i + 24] = True
        if(not is_done[i + 24]):
            dc[i] = (cost(f"c{i}") - cost()) / H
                  
    if(abs(dd) < INDIVIDUAL_DONE_THRESH):
        if(not is_done[36]):
            dd = (cost("dd") - cost()) / H
        is_done[36] = True
    if(not is_done[36]):
        dd = (cost("dd") - cost()) / H

    for i in range(len(a)):
        if(not is_done[i]):
            a[i] -= (da[i] ** 2) * math.copysign(1, da[i]) * LEARNING_RATE2 + da[i] * LEARNING_RATE1 + math.copysign(1, da[i]) * LEARNING_RATE0
        if(not is_done[i + 12]):
            b[i] -= (db[i] ** 2) * math.copysign(1, db[i]) * LEARNING_RATE2 + db[i] * LEARNING_RATE1 + math.copysign(1, db[i]) * LEARNING_RATE0
        if(not is_done[i + 24]):
            c[i] -= (dc[i] ** 2) * math.copysign(1, dc[i]) * LEARNING_RATE2 + dc[i] * LEARNING_RATE1 + math.copysign(1, dc[i]) * LEARNING_RATE0
    if(not is_done[36]):
        d -= (dd ** 2) * math.copysign(1, dd) * LEARNING_RATE2 + dd * LEARNING_RATE1 + math.copysign(1, dd) * LEARNING_RATE0

    if (done_next and (percent_done() >= 37 or last_cost - cost() < DONE_THRESH) and counter >= 100) or counter >= 1000:
        done_next = True
    else:
        done_next = False

    for i in range(len(da)):
        if not (abs(da[i]) < INDIVIDUAL_DONE_THRESH):
            is_done[i] = False
        
        if not (abs(db[i]) < INDIVIDUAL_DONE_THRESH):
            is_done[i + 12] = False

        if not (abs(dc[i]) < INDIVIDUAL_DONE_THRESH):
            is_done[i + 24] = False
                  
    if not (abs(dd) < INDIVIDUAL_DONE_THRESH): 
        is_done[36] = False
    
    #print(f"{round((last_cost - cost()) * 1000)/1000} accuracy gained")

    if(counter % 10 == 0):
        # {round(abs_avg(da + db + dc + [dd])* 1000)/1000} error, 
        print(f"Training model, model has {round(cost() * 1000)/1000} variance, {percent_done()} values done calculating after {counter} iterations")
    if(counter % 50 == 0):
        print(f"After {counter} iterations, prediction:")
        print(f"Red alliance ({t1num}, {t2num}, {t3num}) predicted score: {round(cubic_thing([abs_avg(t1match_scores),
            t1match_scores[-1],
            abs_avg(t2match_scores),
            t2match_scores[-1],
            abs_avg(t3match_scores),
            t3match_scores[-1],
            abs_avg(oppT1opp_match_scores),
            oppT1opp_match_scores[-1],
            abs_avg(oppT2opp_match_scores),
            oppT2opp_match_scores[-1],
            abs_avg(oppT3opp_match_scores),
            oppT3opp_match_scores[-1]
            ]) * 1000)/1000}")
        print(f"Blue alliance ({oppT1num}, {oppT2num}, {oppT3num}) predicted score: {round(cubic_thing([abs_avg(oppT1match_scores),
            oppT1match_scores[-1],
            abs_avg(oppT2match_scores),
            oppT2match_scores[-1],
            abs_avg(oppT3match_scores),
            oppT3match_scores[-1],
            abs_avg(t1opp_match_scores),
            t1opp_match_scores[-1],
            abs_avg(t2opp_match_scores),
            t2opp_match_scores[-1],
            abs_avg(t3opp_match_scores),
            t3opp_match_scores[-1]
            ]) * 1000)/1000}")

print("Model done training!")
print(f"Model finished with {round(cost() * 1000)/1000} variance, {percent_done()} values done calcualting after {counter} iterations")

print(f"Red alliance ({t1num}, {t2num}, {t3num}) predicted score: {round(cubic_thing([abs_avg(t1match_scores),
    t1match_scores[-1],
    abs_avg(t2match_scores),
    t2match_scores[-1],
    abs_avg(t3match_scores),
    t3match_scores[-1],
    abs_avg(oppT1opp_match_scores),
    oppT1opp_match_scores[-1],
    abs_avg(oppT2opp_match_scores),
    oppT2opp_match_scores[-1],
    abs_avg(oppT3opp_match_scores),
    oppT3opp_match_scores[-1]
    ]) * 1000)/1000}")
print(f"Blue alliance ({oppT1num}, {oppT2num}, {oppT3num}) predicted score: {round(cubic_thing([abs_avg(oppT1match_scores),
    oppT1match_scores[-1],
    abs_avg(oppT2match_scores),
    oppT2match_scores[-1],
    abs_avg(oppT3match_scores),
    oppT3match_scores[-1],
    abs_avg(t1opp_match_scores),
    t1opp_match_scores[-1],
    abs_avg(t2opp_match_scores),
    t2opp_match_scores[-1],
    abs_avg(t3opp_match_scores),
    t3opp_match_scores[-1]
    ]) * 1000)/1000}")