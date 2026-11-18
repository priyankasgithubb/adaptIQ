
"""
AdaptIQ — Phase 5.5
XGBoost academic performance prediction.

Train and validate an XGBoost regression model
using synthetic test data.

The test dataset remains untouched.

Run:
    python -m ml.xgboost_model
"""

import numpy as np

from xgboost import XGBRegressor

from ml.features import FEATURE_COLUMNS, TARGET_COLUMN
from ml.split_data import (
    make_synthetic_test_data,
    split_training_data,
)
from ml.baseline import (
    evaluate_predictions,
    previous_score_baseline,
)


def train_xgboost(training_data):
    """
    Train an XGBoost regression model.

    Uses only features available before the
    assessment being predicted.
    """

    X_train = training_data[FEATURE_COLUMNS]
    y_train = training_data[TARGET_COLUMN]

    model = XGBRegressor(
        n_estimators=100,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=-1,
    )

    model.fit(X_train, y_train)

    return model


def predict_scores(model, dataset):
    """
    Predict next assessment percentages.

    Restrict predictions to valid score values.
    """

    predictions = model.predict(
        dataset[FEATURE_COLUMNS]
    )

    return np.clip(predictions, 0, 100)


def run_xgboost_demo():
    print("\nAdaptIQ — Phase 5.5 XGBoost")
    print("-" * 48)
    print("Dataset: SYNTHETIC TEST DATA ONLY\n")

    raw_data = make_synthetic_test_data()

    splits = split_training_data(raw_data)

    train = splits["train"]
    validation = splits["validation"]

    print(f"Training records: {len(train)}")
    print(f"Validation records: {len(validation)}")
    print("Test records: reserved\n")

    model = train_xgboost(train)

    actual = validation[TARGET_COLUMN].to_numpy(
        dtype=float
    )

    xgb_predictions = predict_scores(
        model,
        validation,
    )

    xgb_metrics = evaluate_predictions(
        actual,
        xgb_predictions,
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
        f"{'XGBoost':<22}"
        f"{xgb_metrics['mae']:>10.3f}"
        f"{xgb_metrics['rmse']:>10.3f}"
    )

    print("\nMODEL COMPARISON")
    print("-" * 48)

    if xgb_metrics["mae"] < baseline_metrics["mae"]:
        print("XGBoost outperformed the baseline.")
    elif xgb_metrics["mae"] > baseline_metrics["mae"]:
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
        xgb_predictions,
    ):
        error = abs(actual_score - predicted_score)

        print(
            f"{actual_score:<12.2f}"
            f"{predicted_score:<14.2f}"
            f"{error:<14.2f}"
        )

    print("\nTest set remains untouched.")

    print(
        "Synthetic validation results are for "
        "pipeline testing only."
    )

    return model, xgb_metrics


if __name__ == "__main__":
    run_xgboost_demo()
