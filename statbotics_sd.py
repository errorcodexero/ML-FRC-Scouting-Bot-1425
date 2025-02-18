import statbotics

sb = statbotics.Statbotics()

year = int(input("Enter year: "))
print("Statbotics standard deviation: " + str(sb.get_year(year)["score_sd"]))

