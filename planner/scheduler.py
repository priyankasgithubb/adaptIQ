
from ortools.sat.python import cp_model

SLOT_MIN = 15


# ============================================================
# SHARED HELPER FUNCTIONS
# ============================================================

def follows(slots, a, b):
    """Check if two slots are consecutive on the same day."""
    return (
        slots[a][0] == slots[b][0]
        and slots[b][1] == slots[a][1] + SLOT_MIN
    )


def merge_blocks(chosen):
    """Merge consecutive 15-minute slots into study sessions."""
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
            blocks.append({
                "weekday": weekday,
                "startMin": start,
                "endMin": start + SLOT_MIN,
                "subjectId": subject["id"],
                "subjectName": subject["name"],
            })

    return blocks


# ============================================================
# ORIGINAL WEEKLY TIMETABLE GENERATOR
# ============================================================

def _solve(
    slots,
    subjects,
    daily_limit_min,
    subject_week_cap_min,
    min_block_min,
    fair_slots,
):
    """
    Generate a weekly timetable using OR-Tools.

    Returns chosen 15-minute slots or None if infeasible.
    """

    model = cp_model.CpModel()

    n_slots = len(slots)
    n_subjects = len(subjects)

    min_slots = max(
        1,
        (min_block_min + SLOT_MIN - 1) // SLOT_MIN
    )

    x = {}

    for i in range(n_slots):
        for j in range(n_subjects):
            x[i, j] = model.NewBoolVar(f"x_{i}_{j}")

    # Rule 1: One subject per time slot.
    for i in range(n_slots):
        model.Add(
            sum(x[i, j] for j in range(n_subjects)) <= 1
        )

    # Rule 2: Weekly study limit per subject.
    for j in range(n_subjects):
        model.Add(
            sum(x[i, j] for i in range(n_slots))
            * SLOT_MIN <= subject_week_cap_min
        )

    # Rule 3: Daily study limit.
    slots_by_day = {}

    for i, (weekday, _) in enumerate(slots):
        slots_by_day.setdefault(weekday, []).append(i)

    for day_slots in slots_by_day.values():
        model.Add(
            sum(
                x[i, j]
                for i in day_slots
                for j in range(n_subjects)
            ) * SLOT_MIN <= daily_limit_min
        )

    # Rule 4: Minimum study session duration.
    for j in range(n_subjects):
        for i in range(n_slots):

            before = (
                x[i - 1, j]
                if i > 0 and follows(slots, i - 1, i)
                else 0
            )

            fits = all(
                i + k < n_slots
                and follows(slots, i + k - 1, i + k)
                for k in range(1, min_slots)
            )

            if not fits:
                model.Add(x[i, j] - before <= 0)

            else:
                for k in range(1, min_slots):
                    model.Add(
                        x[i, j] - before <= x[i + k, j]
                    )

    # Rule 5: Fair distribution across subjects.
    if fair_slots > 0:
        for j in range(n_subjects):
            model.Add(
                sum(x[i, j] for i in range(n_slots))
                >= fair_slots
            )

    # Prioritize subjects with higher scores.
    scaled = [
        round(subject["score"] * 1000)
        for subject in subjects
    ]

    model.Maximize(
        sum(
            x[i, j] * scaled[j]
            for i in range(n_slots)
            for j in range(n_subjects)
        )
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0

    status = solver.Solve(model)

    if status not in (
        cp_model.OPTIMAL,
        cp_model.FEASIBLE,
    ):
        return None

    chosen = []

    for i, (weekday, start) in enumerate(slots):
        for j, subject in enumerate(subjects):

            if solver.Value(x[i, j]):
                chosen.append(
                    (weekday, start, subject)
                )
                break

    return chosen


def build_schedule(
    free_windows,
    subjects,
    daily_limit_min=240,
    subject_week_cap_min=240,
    min_block_min=45,
):
    """
    Build the original weekly study timetable.

    free_windows:
        [{weekday, startMin, endMin}]

    subjects:
        [{id, name, score}]

    Returns:
        List of scheduled study blocks.
    """

    slots_set = set()

    for window in free_windows:
        start = (
            (window["startMin"] + SLOT_MIN - 1)
            // SLOT_MIN
        ) * SLOT_MIN

        for minute in range(
            start,
            window["endMin"] - SLOT_MIN + 1,
            SLOT_MIN,
        ):
            slots_set.add(
                (window["weekday"], minute)
            )

    slots = sorted(slots_set)

    if not slots or not subjects:
        return []

    cap_slots = subject_week_cap_min // SLOT_MIN

    fair_slots = min(
        cap_slots,
        len(slots) // len(subjects)
    )

    # First try a balanced timetable.
    chosen = _solve(
        slots,
        subjects,
        daily_limit_min,
        subject_week_cap_min,
        min_block_min,
        fair_slots,
    )

    # Fall back to priority-based scheduling.
    if chosen is None:
        chosen = _solve(
            slots,
            subjects,
            daily_limit_min,
            subject_week_cap_min,
            min_block_min,
            0,
        )

    if chosen is None:
        return []

    return merge_blocks(chosen)


# ============================================================
# AUTOMATIC RESCHEDULING
# ============================================================

def build_recovery_schedule(
    free_windows,
    subjects,
    blocked_windows,
    daily_limit_min=240,
    min_block_min=45,
):
    """
    Reschedule unfinished study time.

    Existing study sessions remain unchanged.

    free_windows:
        [{weekday, startMin, endMin}]

    subjects:
        [{id, name, score, remainingMin}]

    blocked_windows:
        [{weekday, startMin, endMin}]

    Returns:
        Newly scheduled recovery blocks only.

    Unscheduled minutes remain outstanding.
    """

    # --------------------------------------------------------
    # 1. Identify existing occupied time
    # --------------------------------------------------------

    blocked_by_day = {}

    for window in blocked_windows:
        day = window["weekday"]

        blocked_by_day.setdefault(
            day, []
        ).append((
            window["startMin"],
            window["endMin"]
        ))

    occupied_minutes = {}

    for day, intervals in blocked_by_day.items():
        intervals.sort()

        merged = []

        for start, end in intervals:

            if merged and start <= merged[-1][1]:
                merged[-1][1] = max(
                    merged[-1][1],
                    end
                )

            else:
                merged.append([start, end])

        occupied_minutes[day] = sum(
            end - start
            for start, end in merged
        )

    # --------------------------------------------------------
    # 2. Generate available 15-minute slots
    # --------------------------------------------------------

    available = set()

    for window in free_windows:
        day = window["weekday"]

        start = (
            (window["startMin"] + SLOT_MIN - 1)
            // SLOT_MIN
        ) * SLOT_MIN

        end = window["endMin"]

        for minute in range(
            start,
            end - SLOT_MIN + 1,
            SLOT_MIN,
        ):

            overlaps = any(
                minute < blocked_end
                and minute + SLOT_MIN > blocked_start

                for blocked_start, blocked_end
                in blocked_by_day.get(day, [])
            )

            if not overlaps:
                available.add(
                    (day, minute)
                )

    slots = sorted(available)

    # --------------------------------------------------------
    # 3. Calculate remaining study requirements
    # --------------------------------------------------------

    targets = [
        max(
            0,
            int(subject["remainingMin"]) // SLOT_MIN
        )
        for subject in subjects
    ]

    if not slots or not any(targets):
        return []

    # --------------------------------------------------------
    # 4. Optimize recovery sessions
    # --------------------------------------------------------

    def solve(minimum_block_minutes):

        model = cp_model.CpModel()

        n_slots = len(slots)
        n_subjects = len(subjects)

        min_slots = max(
            1,
            (
                minimum_block_minutes
                + SLOT_MIN - 1
            ) // SLOT_MIN
        )

        x = {}

        for i in range(n_slots):
            for j in range(n_subjects):
                x[i, j] = model.NewBoolVar(
                    f"recovery_{i}_{j}"
                )

        # Rule 1: One subject per available slot.
        for i in range(n_slots):
            model.Add(
                sum(
                    x[i, j]
                    for j in range(n_subjects)
                ) <= 1
            )

        # Rule 2: Never exceed unfinished minutes.
        for j in range(n_subjects):
            model.Add(
                sum(
                    x[i, j]
                    for i in range(n_slots)
                ) <= targets[j]
            )

        # Rule 3: Respect daily limits.
        for day in range(7):

            indices = [
                i
                for i, slot in enumerate(slots)
                if slot[0] == day
            ]

            remaining_capacity = max(
                0,
                daily_limit_min
                - occupied_minutes.get(day, 0)
            )

            model.Add(
                sum(
                    x[i, j]
                    for i in indices
                    for j in range(n_subjects)
                ) * SLOT_MIN <= remaining_capacity
            )

        # Rule 4: Minimum session length.
        for j in range(n_subjects):
            for i in range(n_slots):

                before = (
                    x[i - 1, j]
                    if i > 0
                    and follows(slots, i - 1, i)
                    else 0
                )

                fits = all(
                    i + k < n_slots
                    and follows(
                        slots,
                        i + k - 1,
                        i + k
                    )
                    for k in range(1, min_slots)
                )

                if not fits:
                    model.Add(
                        x[i, j] - before <= 0
                    )

                else:
                    for k in range(1, min_slots):
                        model.Add(
                            x[i, j] - before
                            <= x[i + k, j]
                        )

        # Rule 5: Recover maximum minutes first,
        # then favor higher-priority subjects
        # and earlier available slots.
        priorities = [
            max(
                0,
                min(
                    1000,
                    round(s["score"] * 100)
                )
            )
            for s in subjects
        ]

        base_weight = (
            100100 * n_slots
        ) + 1

        model.Maximize(
            sum(
                x[i, j] * (
                    base_weight
                    + priorities[j] * 100
                    + min(
                        100,
                        n_slots - i
                    )
                )

                for i in range(n_slots)
                for j in range(n_subjects)
            )
        )

        solver = cp_model.CpSolver()

        solver.parameters.max_time_in_seconds = 5.0

        status = solver.Solve(model)

        if status not in (
            cp_model.OPTIMAL,
            cp_model.FEASIBLE,
        ):
            return []

        chosen = []

        for i, (weekday, start) in enumerate(slots):
            for j, subject in enumerate(subjects):

                if solver.Value(x[i, j]):
                    chosen.append(
                        (weekday, start, subject)
                    )
                    break

        return chosen

    # --------------------------------------------------------
    # 5. Try normal-length sessions first
    # --------------------------------------------------------

    chosen = solve(min_block_min)

    # Permit shorter sessions when they recover more time.
    short_chosen = solve(SLOT_MIN)

    if len(short_chosen) > len(chosen):
        chosen = short_chosen

    # --------------------------------------------------------
    # 6. Return rescheduled study blocks
    # --------------------------------------------------------

    return merge_blocks(chosen)
