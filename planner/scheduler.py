from ortools.sat.python import cp_model

SLOT_MIN = 15  # the timetable is built in 15-minute slots


def follows(slots, a, b):
    """True if slot b starts exactly when slot a ends, on the same day."""
    return slots[a][0] == slots[b][0] and slots[b][1] == slots[a][1] + SLOT_MIN


def _solve(slots, subjects, daily_limit_min, subject_week_cap_min, min_block_min, fair_slots):
    """Returns a list of (weekday, start, subject) for each used slot, or None if nothing fits."""
    model = cp_model.CpModel()
    n_slots = len(slots)
    n_subjects = len(subjects)
    min_slots = max(1, -(-min_block_min // SLOT_MIN))  # 45 min = 3 slots

    # x[i, j] = 1 means "slot i is used for subject j"
    x = {}
    for i in range(n_slots):
        for j in range(n_subjects):
            x[i, j] = model.NewBoolVar(f"x_{i}_{j}")

    # Rule 1: each slot holds at most one subject
    for i in range(n_slots):
        model.Add(sum(x[i, j] for j in range(n_subjects)) <= 1)

    # Rule 2: each subject gets at most subject_week_cap_min per week
    for j in range(n_subjects):
        model.Add(sum(x[i, j] for i in range(n_slots)) * SLOT_MIN <= subject_week_cap_min)

    # Rule 3: each day gets at most daily_limit_min of study
    slots_by_day = {}
    for i, (weekday, _) in enumerate(slots):
        slots_by_day.setdefault(weekday, []).append(i)
    for day_slots in slots_by_day.values():
        model.Add(
            sum(x[i, j] for i in day_slots for j in range(n_subjects)) * SLOT_MIN
            <= daily_limit_min
        )

    # Rule 4: a block lasts at least min_slots slots
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

    # Rule 5 (fairness): every subject gets at least fair_slots slots
    if fair_slots > 0:
        for j in range(n_subjects):
            model.Add(sum(x[i, j] for i in range(n_slots)) >= fair_slots)

    # Goal: use the time, giving more weight to higher-priority subjects
    scaled = [round(s["score"] * 1000) for s in subjects]
    model.Maximize(
        sum(x[i, j] * scaled[j] for i in range(n_slots) for j in range(n_subjects))
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    chosen = []
    for i, (weekday, start) in enumerate(slots):
        for j, subject in enumerate(subjects):
            if solver.Value(x[i, j]):
                chosen.append((weekday, start, subject))
                break
    return chosen


def build_schedule(free_windows, subjects, daily_limit_min=240,
                   subject_week_cap_min=240, min_block_min=45):
    """
    free_windows: [{weekday, startMin, endMin}]  minutes counted from midnight
    subjects:     [{id, name, score}]            higher score = more important
    Returns:      [{weekday, startMin, endMin, subjectId, subjectName}]
    """
    # 1. Turn every free window into 15-minute slots
    slots = []
    for w in free_windows:
        t = w["startMin"]
        while t + SLOT_MIN <= w["endMin"]:
            slots.append((w["weekday"], t))
            t += SLOT_MIN

    if not slots or not subjects:
        return []

    # 2. Fair share: split the free slots equally, but no subject can exceed its weekly cap
    cap_slots = subject_week_cap_min // SLOT_MIN
    fair_slots = min(cap_slots, len(slots) // len(subjects))

    # 3. Try the fair split first. If it can't fit, fall back to priority only.
    chosen = _solve(slots, subjects, daily_limit_min, subject_week_cap_min, min_block_min, fair_slots)
    if chosen is None:
        chosen = _solve(slots, subjects, daily_limit_min, subject_week_cap_min, min_block_min, 0)
    if chosen is None:
        return []

    # 4. Sort the chosen slots and merge neighbours into blocks
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