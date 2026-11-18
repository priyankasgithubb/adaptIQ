
"""
AdaptIQ — Phase 5.4
Random Forest academic performance prediction.

Train and validate a Random Forest regression model
using synthetic test data.

The test dataset remains untouched.

Run:
    python -m ml.random_forest
"""

import numpy as np

from sklearn.ensemble import RandomForestRegressor

from ml.features import FEATURE_COLUMNS, TARGET_COLUMN
from ml.split_data import (
    make_synthetic_test_data,
    split_training_data,
)
from ml.baseline import (
    evaluate_predictions,
    previous_score_baseline,
)


def train_random_forest(training_data):
    """
    Train a Random Forest regression model.

    All feature values must be available before
    the assessment being predicted.
    """

    X_train = training_data[FEATURE_COLUMNS]
    y_train = training_data[TARGET_COLUMN]

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(X_train, y_train)

    return model


def predict_scores(model, dataset):
    """
    Predict assessment scores as percentages.

    Predictions are restricted to the 0–100 range.
    """

    X = dataset[FEATURE_COLUMNS]

    predictions = model.predict(X)

    return np.clip(predictions, 0, 100)


def run_random_forest_demo():
    print("\nAdaptIQ — Phase 5.4 Random Forest")
    print("-" * 48)
    print("Dataset: SYNTHETIC TEST DATA ONLY\n")

    raw_data = make_synthetic_test_data()

    splits = split_training_data(raw_data)

    train = splits["train"]
    validation = splits["validation"]

    print(f"Training records: {len(train)}")
    print(f"Validation records: {len(validation)}")
    print("Test records: reserved\n")

    # Train only on training data.
    model = train_random_forest(train)

    # Evaluate on unseen validation learners.
    actual = validation[TARGET_COLUMN].to_numpy(
        dtype=float
    )

    rf_predictions = predict_scores(
        model,
        validation,
    )

    rf_metrics = evaluate_predictions(
        actual,
        rf_predictions,
    )

    baseline_predictions = previous_score_baseline(
        validation
    )

    baseline_metrics = evaluate_predictions(
        actual,
        baseline_predictions,
    )

    print("VALIDATION RESULTS")
    print("-" * 48)

    print(
        f"{'Model':<22}"
        f"{'MAE':>10}"
        f"{'RMSE':>10}"
    )

    print(
        f"{'Previous score':<22}"
        f"{baseline_metrics['mae']:>10.3f}"
        f"{baseline_metrics['rmse']:>10.3f}"
    )

    print(
        f"{'Random Forest':<22}"
        f"{rf_metrics['mae']:>10.3f}"
        f"{rf_metrics['rmse']:>10.3f}"
    )

    print("\nMODEL COMPARISON")
    print("-" * 48)

    if rf_metrics["mae"] < baseline_metrics["mae"]:
        print("Random Forest outperformed the baseline.")
    elif rf_metrics["mae"] > baseline_metrics["mae"]:
        print("The previous-score baseline performed better.")
    else:
        print("Both models achieved the same MAE.")

    print("\nFEATURE IMPORTANCE (EXPLORATORY)")
    print("-" * 48)

    importances = sorted(
        zip(
            FEATURE_COLUMNS,
            model.feature_importances_,
        ),
        key=lambda item: item[1],
        reverse=True,
    )

    for feature, importance in importances:
        print(f"{feature:<32} {importance:.4f}")

    print("\nSAMPLE VALIDATION PREDICTIONS")
    print("-" * 48)

    print(
        f"{'Actual':<12}"
        f"{'Predicted':<14}"
        f"{'Absolute error':<14}"
    )

    for actual_score, predicted_score in zip(
        actual,
        rf_predictions,
    ):
        error = abs(actual_score - predicted_score)

        print(
            f"{actual_score:<12.2f}"
            f"{predicted_score:<14.2f}"
            f"{error:<14.2f}"
        )

    print(
        "\nTest set remains untouched."
    )

    print(
        "Synthetic validation results are for "
        "pipeline testing only."
    )

    return model, rf_metrics


if __name__ == "__main__":
    run_random_forest_demo()
