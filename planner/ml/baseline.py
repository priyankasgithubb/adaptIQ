
"""
AdaptIQ — Phase 5.3
Baseline academic performance prediction.

Compares two simple baselines:
1. Previous score baseline
2. Training-set mean baseline

Uses synthetic data for pipeline testing only.

Run:
    python -m ml.baseline
"""

import numpy as np

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
)

from ml.features import TARGET_COLUMN
from ml.split_data import (
    make_synthetic_test_data,
    split_training_data,
)


def evaluate_predictions(actual, predicted):
    """
    Calculate regression error metrics.

    Scores are percentages from 0 to 100.
    MAE and RMSE are measured in percentage points.
    """
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)

    if actual.shape != predicted.shape:
        raise ValueError(
            "Actual and predicted values must have matching shapes."
        )

    if actual.size == 0:
        raise ValueError("Cannot evaluate empty predictions.")

    if not np.isfinite(actual).all():
        raise ValueError("Actual scores contain invalid values.")

    if not np.isfinite(predicted).all():
        raise ValueError("Predictions contain invalid values.")

    return {
        "mae": float(
            mean_absolute_error(actual, predicted)
        ),
        "rmse": float(
            np.sqrt(mean_squared_error(actual, predicted))
        ),
    }


def previous_score_baseline(dataset):
    """
    Predict the next assessment score using
    the previous assessment score.
    """
    return dataset["previous_score_pct"].to_numpy(
        dtype=float
    )


def mean_score_baseline(dataset, training_mean):
    """
    Predict the same training-set average for
    every assessment.

    The mean must be calculated using training
    records only, never validation or test targets.
    """
    return np.full(
        len(dataset),
        training_mean,
        dtype=float,
    )


def run_baseline_demo():
    print("\nAdaptIQ — Phase 5.3 Baseline Evaluation")
    print("-" * 48)
    print("Dataset: SYNTHETIC TEST DATA ONLY\n")

    # Reuse the validated learner-separated,
    # chronological data splitting pipeline.
    raw_data = make_synthetic_test_data()

    splits = split_training_data(raw_data)

    train = splits["train"]
    validation = splits["validation"]

    # The test split is intentionally not evaluated yet.
    # It will remain held out for final model comparison.
    training_mean = float(
        train[TARGET_COLUMN].mean()
    )

    print(f"Training records: {len(train)}")
    print(f"Validation records: {len(validation)}")
    print(f"Training mean: {training_mean:.2f}%\n")

    actual = validation[TARGET_COLUMN].to_numpy(
        dtype=float
    )

    previous_predictions = previous_score_baseline(
        validation
    )

    mean_predictions = mean_score_baseline(
        validation,
        training_mean,
    )

    previous_metrics = evaluate_predictions(
        actual,
        previous_predictions,
    )

    mean_metrics = evaluate_predictions(
        actual,
        mean_predictions,
    )

    results = {
        "Previous score": previous_metrics,
        "Training mean": mean_metrics,
    }

    print("VALIDATION RESULTS")
    print("-" * 48)

    print(
        f"{'Baseline':<20}"
        f"{'MAE':>10}"
        f"{'RMSE':>10}"
    )

    for name, metrics in results.items():
        print(
            f"{name:<20}"
            f"{metrics['mae']:>10.3f}"
            f"{metrics['rmse']:>10.3f}"
        )

    # Select the better baseline using validation
    # results, not the untouched test set.
    best_name = min(
        results,
        key=lambda name: results[name]["mae"],
    )

    best_metrics = results[best_name]

    print("\nBEST VALIDATION BASELINE")
    print("-" * 48)

    print(f"Model: {best_name}")
    print(f"MAE: {best_metrics['mae']:.3f}")
    print(f"RMSE: {best_metrics['rmse']:.3f}")

    print(
        "\nTest split: RESERVED for final evaluation."
    )

    print(
        "These results verify the pipeline, "
        "not real-world predictive accuracy."
    )

    return results


if __name__ == "__main__":
    run_baseline_demo()
