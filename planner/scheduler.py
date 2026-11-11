from ortools.sat.python import cp_model

SLOT_MIN = 15  # the timetable is built in 15-minute slots


def follows(slots, a, b):
    """True if slot b starts exactly when slot a ends, on the same day."""
    return slots[a][0] == slots[b][0] and slots[b][1] == slots[a][1] + SLOT_MIN


def build_schedule(free_windows, subjects, daily_limit_min=240,
                   subject_week_cap_min=240, min_block_min=45):
    # 1. Turn every free window into 15-minute slots
    slots = []
    for w in free_windows:
        t = w["startMin"]
        while t + SLOT_MIN <= w["endMin"]:
            slots.append((w["weekday"], t))
            t += SLOT_MIN

    if not slots or not subjects:
        return []

    model = cp_model.CpModel()
    n_slots = len(slots)
    n_subjects = len(subjects)
    min_slots = max(1, -(-min_block_min // SLOT_MIN))  # 45 min = 3 slots

    # 2. x[i, j] = 1 means "slot i is used for subject j"
    x = {}
    for i in range(n_slots):
        for j in range(n_subjects):
            x[i, j] = model.NewBoolVar(f"x_{i}_{j}")

    # 3. Rule: each slot holds at most one subject
    for i in range(n_slots):
        model.Add(sum(x[i, j] for j in range(n_subjects)) <= 1)

    # 4. Rule: each subject gets at most subject_week_cap_min per week
    for j in range(n_subjects):
        model.Add(sum(x[i, j] for i in range(n_slots)) * SLOT_MIN <= subject_week_cap_min)

    # 5. Rule: each day gets at most daily_limit_min of study
    slots_by_day = {}
    for i, (weekday, _) in enumerate(slots):
        slots_by_day.setdefault(weekday, []).append(i)
    for day_slots in slots_by_day.values():
        model.Add(
            sum(x[i, j] for i in day_slots for j in range(n_subjects)) * SLOT_MIN
            <= daily_limit_min
        )

    # 6. Rule: a block lasts at least min_slots slots.
    # If slot i starts a block of subject j (it is j, and the slot before is not j),
    # the next min_slots - 1 slots must also be j.
    for j in range(n_subjects):
        for i in range(n_slots):
            before = x[i - 1, j] if i > 0 and follows(slots, i - 1, i) else 0
            fits = all(
                i + k < n_slots and follows(slots, i + k - 1, i + k)
                for k in range(1, min_slots)
            )
            if not fits:
                model.Add(x[i, j] - before <= 0)  # a block can't start here
            else:
                for k in range(1, min_slots):
                    model.Add(x[i, j] - before <= x[i + k, j])

    # 7. Goal: fill the most time with the highest-priority subjects.
    # The solver needs whole numbers, so scores are multiplied by 1000.
    scaled = [round(s["score"] * 1000) for s in subjects]
    model.Maximize(
        sum(x[i, j] * scaled[j] for i in range(n_slots) for j in range(n_subjects))
    )

    # 8. Solve (5 seconds at most)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return []

    # 9. Collect the chosen slots, then merge neighbouring slots into blocks
    chosen = []
    for i, (weekday, start) in enumerate(slots):
        for j, subject in enumerate(subjects):
            if solver.Value(x[i, j]):
                chosen.append((weekday, start, subject))
                break
    chosen.sort(key=lambda c: (c[0], c[1]))

    blocks = []
    for weekday, start, subject in chosen:
        last = blocks[-1] if blocks else None
        if (
            last
            and last["weekday"] == weekday
            and last["subjectId"] == subject["id"]
            and last["endMin"] == start
        ):
            last["endMin"] = start + SLOT_MIN
        else:
            blocks.append(
                {
                    "weekday": weekday,
                    "startMin": start,
                    "endMin": start + SLOT_MIN,
                    "subjectId": subject["id"],
                    "subjectName": subject["name"],
                }
            )
    return blocks