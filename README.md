# student-performance-predictor

A personal data science project: answer 15 questions about your study routine, environment and lifestyle, and a trained machine-learning model predicts your exam score and suggests what to improve.

**Live demo:** https://student-performance-predictor-vert-chi.vercel.app

## Features

- Exam score prediction (0 to 100) from 15 factors, computed by a real trained model
- Insights and recommendations based on your answers
- "What if" scenarios (e.g. +5 study hours, full attendance), each recalculated by the same model
- 6 pages: Home, Predict, Quiz, How it works, Improve, About
- 3 languages: Russian, English, Uzbek
- Habits quiz with explanations after each answer
- Prediction history and side-by-side comparison, saved only in your own browser
- Sovi, the study owl mascot
- Light and dark theme, 3D graduation cap on the home page (Three.js)

## How it works

```
Browser (this repo, Vercel)  --JSON-->  FastAPI + scikit-learn model (Render)  -->  predicted score
```

- **Frontend (this repo):** plain HTML, CSS and JavaScript, no build step, hosted on Vercel.
- **Backend:** FastAPI service with a scikit-learn regression model, hosted on Render: [student-performance-predictor](https://github.com/umarkhodjaev-hash/student-performance-predictor).
- The backend runs on a free tier, so the first prediction after a period of inactivity can take up to a minute.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Home page with 3D cap |
| `predict.html` | 3-step form, results, history and comparison |
| `quiz.html` | Habits quiz |
| `how-it-works.html` | Explanation, factors, limitations, FAQ |
| `improve.html` | Study tips and 7-day plan |
| `about.html` | About the project |
| `style.css` | Shared styles |
| `vercel.json` | Clean URLs for Vercel |

## Disclaimer

This is an educational project. Predictions are estimates based on patterns in data and do not guarantee results. Do not use them for important decisions about yourself or other people.

## Author

Umar, a student from Tashkent, Uzbekistan. [GitHub](https://github.com/umarkhodjaev-hash)






