
import pandas as pd

# Features available before the assessment being predicted.
BASE_FEATURES = [
    "previous_score_pct",
    "recent_average_pct",
    "completed_study_minutes_7d",
    "planned_study_minutes_7d",
    "missed_sessions_7d",
]

DERIVED_FEATURES = [
    "study_adherence_7d",
    "has_planned_study",
]

FEATURE_COLUMNS = BASE_FEATURES + DERIVED_FEATURES

TARGET_COLUMN = "next_assessment_score_pct"

IDENTIFIER_COLUMNS = [
    "student_id",
    "subject_id",
    "snapshot_at",
]

NUMERIC_LIMITS = {
    "previous_score_pct": (0, 100),
    "recent_average_pct": (0, 100),
    "completed_study_minutes_7d": (0, None),
    "planned_study_minutes_7d": (0, None),
    "missed_sessions_7d": (0, None),
    "next_assessment_score_pct": (0, 100),
}


def prepare_features(dataframe, training=True):
    """
    Validate and transform academic snapshots.

    Each snapshot must contain only information available
    at snapshot_at.

    When training=True, the next observed assessment
    score is required as the prediction target.

    Returns a validated DataFrame containing identifiers,
    model features, and the target when applicable.
    """

    df = dataframe.copy()

    required = IDENTIFIER_COLUMNS + BASE_FEATURES

    if training:
        required += [
            TARGET_COLUMN,
            "target_assessed_at",
        ]

    missing = [
        column for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    if df.empty:
        raise ValueError("The dataset is empty.")

    for column in ["student_id", "subject_id"]:
        df[column] = df[column].astype("string").str.strip()

        if df[column].isna().any() or df[column].eq("").any():
            raise ValueError(
                f"{column} contains missing identifiers."
            )

    df["snapshot_at"] = pd.to_datetime(
        df["snapshot_at"],
        errors="coerce",
        utc=True,
    )

    if df["snapshot_at"].isna().any():
        raise ValueError(
            "snapshot_at contains invalid or missing dates."
        )

    if training:
        df["target_assessed_at"] = pd.to_datetime(
            df["target_assessed_at"],
            errors="coerce",
            utc=True,
        )

        if df["target_assessed_at"].isna().any():
            raise ValueError(
                "target_assessed_at contains invalid dates."
            )

        if (
            df["target_assessed_at"] <= df["snapshot_at"]
        ).any():
            raise ValueError(
                "Target assessment must occur after its snapshot."
            )

    numeric_columns = BASE_FEATURES.copy()

    if training:
        numeric_columns.append(TARGET_COLUMN)

    for column in numeric_columns:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

        if df[column].isna().any():
            raise ValueError(
                f"{column} contains missing or invalid values."
            )

        minimum, maximum = NUMERIC_LIMITS[column]

        if (df[column] < minimum).any():
            raise ValueError(
                f"{column} contains values below {minimum}."
            )

        if maximum is not None and (
            df[column] > maximum
        ).any():
            raise ValueError(
                f"{column} contains values above {maximum}."
            )

    if (
        df["missed_sessions_7d"] % 1 != 0
    ).any():
        raise ValueError(
            "missed_sessions_7d must contain whole numbers."
        )

    duplicate_snapshots = df.duplicated(
        subset=IDENTIFIER_COLUMNS
    )

    if duplicate_snapshots.any():
        raise ValueError(
            "Duplicate student-subject snapshots found."
        )

    # Avoid division by zero when no sessions were planned.
    planned = df["planned_study_minutes_7d"]
    completed = df["completed_study_minutes_7d"]

    df["has_planned_study"] = (planned > 0).astype(int)

    df["study_adherence_7d"] = 0.0

    has_plan = planned > 0

    df.loc[has_plan, "study_adherence_7d"] = (
        completed[has_plan] / planned[has_plan]
    ).clip(0, 1)

    selected_columns = (
        IDENTIFIER_COLUMNS + FEATURE_COLUMNS
    )

    if training:
        selected_columns += [
            "target_assessed_at",
            TARGET_COLUMN,
        ]

    return (
        df[selected_columns]
        .sort_values(
            ["student_id", "subject_id", "snapshot_at"]
        )
        .reset_index(drop=True)
    )


def load_training_data(csv_path):
    """Load and validate historical training snapshots."""
    dataframe = pd.read_csv(csv_path)

    return prepare_features(
        dataframe,
        training=True,
    )


def split_features_and_target(dataframe):
    """
    Extract model inputs and targets.

    Actual train/validation/test splitting will be
    implemented separately in Phase 5.2.
    """
    features = dataframe[FEATURE_COLUMNS].copy()
    target = dataframe[TARGET_COLUMN].copy()

    return features, target
