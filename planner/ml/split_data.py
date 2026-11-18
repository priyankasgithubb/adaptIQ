
"""
AdaptIQ — Phase 5.2

Learner-separated, chronological data splitting.

This module prepares train, validation, and test
datasets without sharing students across splits.

Run:
    python -m ml.split_data

The included synthetic records are for pipeline
testing only, not real model evaluation.
"""

import pandas as pd

from ml.features import (
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    prepare_features,
)


def split_training_data(
    dataframe,
    train_fraction=0.60,
    validation_fraction=0.20,
):
    """
    Divide historical academic records into three sets.

    Rules:
    1. Every student belongs to exactly one split.
    2. Student cohorts are ordered by their earliest snapshot.
    3. Training outcomes must precede validation inputs.
    4. Validation outcomes must precede test inputs.
    5. All splits must contain at least one student.

    A ValueError is raised if strict chronological
    separation cannot be achieved.
    """

    if not (
        0 < train_fraction < 1
        and 0 < validation_fraction < 1
        and train_fraction + validation_fraction < 1
    ):
        raise ValueError("Invalid split fractions.")

    df = prepare_features(
        dataframe,
        training=True,
    )

    # Determine when each learner first appears.
    learner_dates = (
        df.groupby("student_id")["snapshot_at"]
        .min()
        .sort_values()
    )

    learner_ids = learner_dates.index.tolist()
    total_learners = len(learner_ids)

    if total_learners < 5:
        raise ValueError(
            "At least five distinct learners are required "
            "for this split demonstration."
        )

    train_count = int(total_learners * train_fraction)
    validation_count = int(
        total_learners * validation_fraction
    )

    test_count = (
        total_learners - train_count - validation_count
    )

    if min(train_count, validation_count, test_count) < 1:
        raise ValueError(
            "Not enough learners for the requested splits."
        )

    train_ids = set(learner_ids[:train_count])

    validation_ids = set(
        learner_ids[
            train_count:train_count + validation_count
        ]
    )

    test_ids = set(
        learner_ids[train_count + validation_count:]
    )

    train = df[
        df["student_id"].isin(train_ids)
    ].copy()

    validation = df[
        df["student_id"].isin(validation_ids)
    ].copy()

    test = df[
        df["student_id"].isin(test_ids)
    ].copy()

    # Check learner independence.
    if (
        train_ids & validation_ids
        or train_ids & test_ids
        or validation_ids & test_ids
    ):
        raise ValueError(
            "Student leakage detected between splits."
        )

    # Check chronological separation.
    train_last_outcome = train[
        "target_assessed_at"
    ].max()

    validation_first_input = validation[
        "snapshot_at"
    ].min()

    validation_last_outcome = validation[
        "target_assessed_at"
    ].max()

    test_first_input = test[
        "snapshot_at"
    ].min()

    if train_last_outcome >= validation_first_input:
        raise ValueError(
            "Training outcomes overlap validation inputs. "
            "Choose a wider chronological separation."
        )

    if validation_last_outcome >= test_first_input:
        raise ValueError(
            "Validation outcomes overlap test inputs. "
            "Choose a wider chronological separation."
        )

    return {
        "train": train.reset_index(drop=True),
        "validation": validation.reset_index(drop=True),
        "test": test.reset_index(drop=True),
    }


def make_synthetic_test_data():
    """
    Generate small, artificial assessment snapshots.

    Each learner has two subjects and belongs to a
    chronological cohort separated by 21 days.

    These values are invented for software testing.
    They must not be treated as real student results.
    """

    records = []

    start = pd.Timestamp(
        "2024-01-01",
        tz="UTC",
    )

    for student_number in range(1, 16):
        student_id = f"synthetic_student_{student_number:02d}"

        snapshot_date = start + pd.Timedelta(
            days=(student_number - 1) * 21
        )

        for subject_number, subject_name in enumerate(
            ["Mathematics", "Physics"]
        ):
            previous_score = min(
                100,
                45 + student_number + subject_number * 6,
            )

            recent_average = min(
                100,
                previous_score + 3,
            )

            planned_minutes = 180
            completed_minutes = (
                90 + student_number * 5
            )

            missed_sessions = student_number % 3

            next_score = min(
                100,
                previous_score + 4,
            )

            records.append(
                {
                    "student_id": student_id,
                    "subject_id": subject_name,
                    "snapshot_at": snapshot_date,
                    "previous_score_pct": previous_score,
                    "recent_average_pct": recent_average,
                    "completed_study_minutes_7d": completed_minutes,
                    "planned_study_minutes_7d": planned_minutes,
                    "missed_sessions_7d": missed_sessions,
                    "target_assessed_at": (
                        snapshot_date
                        + pd.Timedelta(days=7)
                    ),
                    "next_assessment_score_pct": next_score,
                }
            )

    return pd.DataFrame(records)


def run_demo():
    print("\nAdaptIQ — Phase 5.2 Validation")
    print("-" * 40)

    raw_data = make_synthetic_test_data()

    splits = split_training_data(raw_data)

    print("Dataset: SYNTHETIC TEST DATA ONLY")
    print(f"Total records: {len(raw_data)}")

    for name, dataset in splits.items():
        print(
            f"{name.capitalize()}: "
            f"{len(dataset)} records, "
            f"{dataset['student_id'].nunique()} students"
        )

    # Confirm every record is assigned once.
    combined = pd.concat(
        splits.values(),
        ignore_index=True,
    )

    assert len(combined) == len(raw_data)

    # Confirm the feature matrix is ready.
    for dataset in splits.values():
        assert dataset[FEATURE_COLUMNS].notna().all().all()
        assert dataset[TARGET_COLUMN].notna().all()

    # Confirm a deliberately invalid assessment date
    # is rejected by the validation pipeline.
    invalid_data = raw_data.copy()

    invalid_data.loc[
        0, "target_assessed_at"
    ] = invalid_data.loc[0, "snapshot_at"]

    try:
        prepare_features(invalid_data, training=True)
    except ValueError:
        print("Invalid target date: correctly rejected")
    else:
        raise AssertionError(
            "Invalid target date was not rejected."
        )

    print("Learner overlap: none")
    print("Chronological boundaries: passed")
    print("Feature validation: passed")
    print("\nPhase 5.2 demo tests passed.")


if __name__ == "__main__":
    run_demo()
