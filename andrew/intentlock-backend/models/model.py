import numpy as np
from sklearn.linear_model import LogisticRegression
import joblib
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'intent_model.joblib')

class IntentModel:
    def __init__(self):
        if os.path.exists(MODEL_PATH):
            self.model = joblib.load(MODEL_PATH)
        else:
            X = np.array([
                [2, 10],
                [4, 8],
                [6, 6],
                [15, 2],
                [20, 1],
                [30, 0],
            ])

            y = np.array([1, 1, 1, 0, 0, 0]) # 1 = impulsive, 0 = genuine

            self.model = LogisticRegression()
            self.model.fit(X, y)
            joblib.dump(self.model, MODEL_PATH)

    def predict(self, session_minutes, typing_speed):
        prediction = self.model.predict([[session_minutes, typing_speed]])
        return int(prediction[0])