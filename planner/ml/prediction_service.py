
"""
AdaptIQ — Phase 5.7
Machine Learning Prediction Service

Current status:
- Baseline implemented
- Random Forest implemented
- XGBoost implemented
- Evaluation pipeline implemented
- Real-world model validation pending

Synthetic-data models must not be served
as validated student predictions.
"""

from fastapi import HTTPException

MODEL_VALIDATED = False


def get_prediction_status():
    """Return the current availability of ML predictions."""

    return {
        "available": MODEL_VALIDATED,
        "models": [
            "previous_score",
            "random_forest",
            "xgboost",
        ],
        "validation": "synthetic_only",
        "message": (
            "ML evaluation pipeline is implemented. "
            "Real student predictions are unavailable "
            "until an appropriate model has been "
            "validated on genuine historical data."
        ),
    }


def predict_assessment():
    """
    Guard prediction requests until a validated
    model and serving pipeline are available.
    """

    raise HTTPException(
        status_code=503,
        detail=(
            "Academic predictions are not yet available. "
            "The current models have only been evaluated "
            "using synthetic test data."
        ),
    )
