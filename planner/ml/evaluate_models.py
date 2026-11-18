
"""
AdaptIQ — Phase 5.6
Model comparison and final held-out evaluation.

Models:
1. Previous-score baseline
2. Random Forest
3. XGBoost

Model selection uses validation data only.
The selected model is evaluated once on the test set.

DATASET: SYNTHETIC TEST DATA ONLY

Run:
    python -m ml.evaluate_models
"""

import numpy as np

from ml.baseline import (
    evaluate_predictions,
    previous_score_baseline,
)
from ml.features import TARGET_COLUMN
from ml.random_forest import (
    train_random_forest,
    predict_scores as predict_random_forest,
)
from ml.xgboost_model import (
    train_xgboost,
    predict_scores as predict_xgboost,
)
from ml.split_data import (
    make_synthetic_test_data,
    split_training_data,
)


def evaluate_model(name, actual, predictions):
    metrics = evaluate_predictions(actual, predictions)

    return {
        "model": name,
        "mae": metrics["mae"],
        "rmse": metrics["rmse"],
    }


def print_results(results):
    print(
        f"{'Model':<22}"
        f"{'MAE':>12}"
        f"{'RMSE':>12}"
    )

    print("-" * 46)

    for result in results:
        print(
            f"{result['model']:<22}"
            f"{result['mae']:>12.3f}"
            f"{result['rmse']:>12.3f}"
        )


def run_evaluation():
    print("\nAdaptIQ — Phase 5.6 Model Evaluation")
    print("=" * 50)
    print("DATASET: SYNTHETIC TEST DATA ONLY\n")

    # Reuse the existing data generation
    # and leakage-safe splitting pipeline.
    raw_data = make_synthetic_test_data()
    splits = split_training_data(raw_data)

    train = splits["train"]
    validation = splits["validation"]
    test = splits["test"]

    print(f"Training records: {len(train)}")
    print(f"Validation records: {len(validation)}")
    print(f"Test records: {len(test)}\n")

    # Confirm learner identity separation.
    train_ids = set(train["student_id"])
    validation_ids = set(validation["student_id"])
    test_ids = set(test["student_id"])

    assert train_ids.isdisjoint(validation_ids)
    assert train_ids.isdisjoint(test_ids)
    assert validation_ids.isdisjoint(test_ids)

    print("Learner separation: PASSED\n")

    # -----------------------------------------
    # 1. Train ML models on training data only.
    # -----------------------------------------

    print("Training Random Forest...")
    rf_model = train_random_forest(train)

    print("Training XGBoost...")
    xgb_model = train_xgboost(train)

    print("Training complete.\n")

    # -----------------------------------------
    # 2. Compare models on validation data.
    # -----------------------------------------

    actual_validation = validation[
        TARGET_COLUMN
    ].to_numpy(dtype=float)

    validation_predictions = {
        "Previous score": previous_score_baseline(
            validation
        ),
        "Random Forest": predict_random_forest(
            rf_model,
            validation,
        ),
        "XGBoost": predict_xgboost(
            xgb_model,
            validation,
        ),
    }

    validation_results = []

    for name, predictions in validation_predictions.items():
        validation_results.append(
            evaluate_model(
                name,
                actual_validation,
                predictions,
            )
        )

    print("VALIDATION RESULTS")
    print("-" * 46)
    print_results(validation_results)

    # Select using validation MAE.
    # RMSE breaks ties; model name ensures
    # deterministic ordering if both tie.
    best_result = min(
        validation_results,
        key=lambda result: (
            result["mae"],
            result["rmse"],
            result["model"],
        ),
    )

    best_name = best_result["model"]

    print("\nSELECTED MODEL")
    print("-" * 46)
    print(f"Model: {best_name}")
    print(f"Validation MAE: {best_result['mae']:.3f}")
    print(f"Validation RMSE: {best_result['rmse']:.3f}")

    # -----------------------------------------
    # 3. Final evaluation on untouched test data.
    # -----------------------------------------

    # The test set has not been used during
    # training or model selection.
    actual_test = test[
        TARGET_COLUMN
    ].to_numpy(dtype=float)

    if best_name == "Previous score":
        test_predictions = previous_score_baseline(
            test
        )

    elif best_name == "Random Forest":
        test_predictions = predict_random_forest(
            rf_model,
            test,
        )

    else:
        test_predictions = predict_xgboost(
            xgb_model,
            test,
        )

    test_metrics = evaluate_predictions(
        actual_test,
        test_predictions,
    )

    print("\nFINAL HELD-OUT TEST RESULTS")
    print("-" * 46)
    print(f"Selected model: {best_name}")
    print(f"Test MAE: {test_metrics['mae']:.3f}")
    print(f"Test RMSE: {test_metrics['rmse']:.3f}")

    print("\nTEST PREDICTIONS")
    print("-" * 46)

    print(
        f"{'Actual':<14}"
        f"{'Predicted':<14}"
        f"{'Abs. error':<14}"
    )

    for actual, predicted in zip(
        actual_test,
        test_predictions,
    ):
        print(
            f"{actual:<14.2f}"
            f"{predicted:<14.2f}"
            f"{abs(actual - predicted):<14.2f}"
        )

    # Compare the selected approach with the
    # baseline using test data for reporting,
    # not for changing model selection.
    baseline_test_predictions = (
        previous_score_baseline(test)
    )

    baseline_test_metrics = evaluate_predictions(
        actual_test,
        baseline_test_predictions,
    )

    print("\nBASELINE REFERENCE")
    print("-" * 46)
    print(
        "Previous-score baseline test MAE: "
        f"{baseline_test_metrics['mae']:.3f}"
    )
    print(
        "Previous-score baseline test RMSE: "
        f"{baseline_test_metrics['rmse']:.3f}"
    )

    print("\nEVALUATION SUMMARY")
    print("-" * 46)

    if best_name == "Previous score":
        print(
            "The simple baseline was selected "
            "using validation performance."
        )
    elif (
        test_metrics["mae"]
        < baseline_test_metrics["mae"]
    ):
        print(
            "The selected ML model achieved lower "
            "test MAE than the baseline."
        )
    else:
        print(
            "The selected ML model did not beat "
            "the baseline on held-out test MAE."
        )

    print(
        "\nIMPORTANT: All results are based on "
        "synthetic data."
    )

    print(
        "Do not use these results as evidence "
        "of real-world academic prediction accuracy."
    )

    print(
        "\nPhase 5.6 evaluation pipeline completed."
    )

    return {
        "selected_model": best_name,
        "validation_results": validation_results,
        "test_metrics": test_metrics,
        "baseline_test_metrics": baseline_test_metrics,
        "synthetic_data": True,
    }


if __name__ == "__main__":
    run_evaluation()
