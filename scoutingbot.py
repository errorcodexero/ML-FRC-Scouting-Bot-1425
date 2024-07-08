import statbotics

sb = statbotics.Statbotics()

LEARNING_RATE = 1000000000
H = 0.00001
print(H)

a_this = 1
a_opp = 1
b_this = 1
b_opp = 1
c_this = 1
c_opp = 1
d = 1

year = int(input("enter year:\n"))

print("Getting some test matches...")
year_matches = sb.get_matches(None, year)
#year_matches = year_matches[:1000]

team_data = []
team_training_vals = []

print("Inintalizing data set...")
for i in range(10000):
    team_data.append({"this": [], "opp": []})

def get_pred_next_score(scores):
    a = 1
    b = 1
    c = 1

    da = 100
    db = 100
    dc = 100

    def quadratic(a, b, c, x):
        return a * x * x + b * x + c
    
    def cost(scores, a, b, c):
        ret = 0
        for i in range(len(scores) - 1):
            if(scores[i] == None):
                continue
            ret += abs(scores[i] - quadratic(a, b, c, i)) ** 2
        ret /= len(scores)
        return ret
    
    while(abs(da) > 0.001 or abs(db) > 0.001 or abs(dc) > 0.001):
        da = cost(scores, a + H, b, c) - cost(scores, a, b, c)
        #print(cost(scores, a + H, b, c), cost(scores, a, b, c))
        da /= H
        db = cost(scores, a, b + H, c) - cost(scores, a, b, c)
        db /= H
        dc = cost(scores, a, b, c + H) - cost(scores, a, b, c)
        dc /= H
        a -= LEARNING_RATE * da
        b -= LEARNING_RATE * db
        c -= LEARNING_RATE * dc

        avg_err = abs(da) + abs(db) + abs(dc)
        avg_err /= 3
        print(f"Fitting a curve, model has {cost(scores, a, b, c)} , {avg_err} error", da, ":", db, ":", dc, "   ", a, ":", b, ":", c)
    
    return quadratic(a, b, c, len(scores))

def cubic(a, b, c, d, x):
    return a * x * x * x + b * x * x + c * x + d

def cubic_for_ret(x1_this, x2_this, x3_this, x1_opp, x2_opp, x3_opp, which = None):
    ret = 0

    a_ttmp = a_this + H if which == "at" else a_this
    b_ttmp = b_this + H if which == "bt" else b_this
    c_ttmp = c_this + H if which == "ct" else c_this
    a_otmp = a_opp + H if which == "ao" else a_opp
    b_otmp = b_opp + H if which == "bo" else b_opp
    c_otmp = c_opp + H if which == "co" else c_opp
    d_tmp = d + d if which == "d" else d

    ret += cubic(a_ttmp, b_ttmp, c_ttmp, d_tmp/6, x1_this)
    ret += cubic(a_ttmp, b_ttmp, c_ttmp, d_tmp/6, x2_this)
    ret += cubic(a_ttmp, b_ttmp, c_ttmp, d_tmp/6, x3_this)
    ret += cubic(a_otmp, b_otmp, c_otmp, d_tmp/6, x1_opp)
    ret += cubic(a_otmp, b_otmp, c_otmp, d_tmp/6, x2_opp)
    ret += cubic(a_otmp, b_otmp, c_otmp, d_tmp/6, x3_opp)
    return ret


def train_model(year_matches):
    counter = 0
    for match in year_matches:
        counter += 1
        print(f"Getting match {counter} data...")
        team_data[match["blue_1"]]["this"].append(match["blue_score"])
        team_data[match["blue_1"]]["opp"].append(match["red_score"])
        team_data[match["blue_2"]]["this"].append(match["blue_score"])
        team_data[match["blue_2"]]["opp"].append(match["red_score"])
        team_data[match["blue_3"]]["this"].append(match["blue_score"])
        team_data[match["blue_3"]]["opp"].append(match["red_score"])

        team_data[match["red_1"]]["this"].append(match["red_score"])
        team_data[match["red_1"]]["opp"].append(match["blue_score"])
        team_data[match["red_2"]]["this"].append(match["red_score"])
        team_data[match["red_2"]]["opp"].append(match["blue_score"])
        team_data[match["red_3"]]["this"].append(match["red_score"])
        team_data[match["red_3"]]["opp"].append(match["blue_score"])

        team_training_vals.append({"score" : match["blue_score"],
                                   "t1pred" : get_pred_next_score(team_data[match["blue_1"]]["this"]), 
                                   "t2pred" : get_pred_next_score(team_data[match["blue_2"]]["this"]), 
                                   "t3pred" : get_pred_next_score(team_data[match["blue_3"]]["this"]), 
                                   "t1opp_pred" : get_pred_next_score(team_data[match["red_1"]]["opp"]), 
                                   "t2opp_pred" : get_pred_next_score(team_data[match["red_2"]]["opp"]), 
                                   "t3opp_pred" : get_pred_next_score(team_data[match["red_3"]]["opp"])})
        
        team_training_vals.append({"score" : match["red_score"],
                                   "t1pred" : get_pred_next_score(team_data[match["red_1"]]["this"]), 
                                   "t2pred" : get_pred_next_score(team_data[match["red_2"]]["this"]), 
                                   "t3pred" : get_pred_next_score(team_data[match["red_3"]]["this"]), 
                                   "t1opp_pred" : get_pred_next_score(team_data[match["blue_1"]]["opp"]), 
                                   "t2opp_pred" : get_pred_next_score(team_data[match["blue_2"]]["opp"]), 
                                   "t3opp_pred" : get_pred_next_score(team_data[match["blue_3"]]["opp"])})
        
    
    a_this = 1
    a_opp = 1
    b_this = 1
    b_opp = 1
    c_this = 1
    c_opp = 1
    d = 1

    da_this = 1
    da_opp = 1
    db_this = 1
    db_opp = 1
    dc_this = 1
    dc_opp = 1
    dd = 1
    
    def cost(which = None):
        ret = 0
        for val in team_training_vals:
            if(val["score"] == None):
                continue
            ret += abs(val["score"] - cubic_for_ret(val["t1pred"], val["t2pred"], val["t3pred"], val["t1opp_pred"], val["t2opp_pred"], val["t3opp_pred"], which)) ** 2
        ret /= len(team_training_vals)
        return ret
    
    while abs(da_opp) > 0.01 or abs(da_this) > 0.01 or abs(db_opp > 0.01) or abs(db_this > 0.01) or abs(dc_opp > 0.01) or abs(dc_this) > 0.01 or abs(dd) > 0.01 :
        avg_error = abs(da_this) + abs(da_opp) + abs(db_this) + abs(db_opp) + abs(dc_this) + abs(dc_opp) + abs(dd)
        avg_error /= 7
        print(f"Training model, Lin reg has {avg_error} error")
        da_this = cost("at") - cost()
        da_this /= H
        da_opp = cost("ao") - cost()
        da_opp /= H
        db_this = cost("bt") - cost()
        db_this /= H
        db_opp = cost("bo") - cost()
        db_opp /= H
        dc_this = cost("ct") - cost()
        dc_this /= H
        dc_opp = cost("co") - cost()
        dc_opp /= H
        dd = cost("d") - cost()
        dd /= H

        a_this -= LEARNING_RATE * da_this
        a_opp -= LEARNING_RATE * da_opp
        b_this -= LEARNING_RATE * db_this
        b_opp -= LEARNING_RATE * db_opp
        c_this -= LEARNING_RATE * dc_this
        c_opp -= LEARNING_RATE * dc_opp
        d -= LEARNING_RATE * dd

    avg_error = abs(da_this) + abs(da_opp) + abs(db_this) + abs(db_opp) + abs(dc_this) + abs(dc_opp) + abs(dd)
    avg_error /= 7
    print(f"Finished training with {avg_error} error")

t1num = int(input("enter team 1:\n"))
t2num = int(input("enter team 2:\n"))
t3num = int(input("enter team 3:\n"))

oppT1num = int(input("enter opposing team 1:\n"))
oppT2num = int(input("enter opposing team 2:\n"))
oppT3num = int(input("enter opposing team 3:\n"))

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

print("Getting team data...")
t1match_scores = get_match_scores(t1num)
t2match_scores = get_match_scores(t2num)
t3match_scores = get_match_scores(t3num)

t1opp_match_scores = get_opp_match_scores(t1num)
t2opp_match_scores = get_opp_match_scores(t2num)
t3opp_match_scores = get_opp_match_scores(t3num)

print("Getting opposing team's data...")
oppT1opp_match_scores = get_opp_match_scores(oppT1num)
oppT2opp_match_scores = get_opp_match_scores(oppT2num)
oppT3opp_match_scores = get_opp_match_scores(oppT3num)

oppT1match_scores = get_match_scores(oppT1num)
oppT2match_scores = get_match_scores(oppT2num)
oppT3match_scores = get_match_scores(oppT3num)

print("Getting team match predictions...")
t1next_pred = get_pred_next_score(t1match_scores)
t2next_pred = get_pred_next_score(t2match_scores)
t3next_pred = get_pred_next_score(t3match_scores)

t1opp_next_pred = get_pred_next_score(t1opp_match_scores)
t2opp_next_pred = get_pred_next_score(t2opp_match_scores)
t3opp_next_pred = get_pred_next_score(t3opp_match_scores)

print("Getting opposing team match predictions...")
oppT1opp_next_pred = get_pred_next_score(oppT1opp_match_scores)
oppT2opp_next_pred = get_pred_next_score(oppT2opp_match_scores)
oppT3opp_next_pred = get_pred_next_score(oppT3opp_match_scores)

oppT1next_pred = get_pred_next_score(oppT1match_scores)
oppT2next_pred = get_pred_next_score(oppT2match_scores)
oppT3next_pred = get_pred_next_score(oppT3match_scores)

print("Starting training...")
train_model(year_matches)
print("Model done training!")

this_pred = cubic_for_ret(t1next_pred, t2next_pred, t3next_pred, oppT1opp_next_pred, oppT2opp_next_pred, oppT3opp_next_pred)
opp_pred = cubic_for_ret(oppT1next_pred, oppT2next_pred, oppT3next_pred, t1opp_next_pred, t2opp_next_pred, t3opp_next_pred)

print(f"This team predicted score: {this_pred}")
print(f"Opponent team predicted score: {opp_pred}")