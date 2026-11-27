
# AdaptIQ — Adaptive Learning and Study Planning Platform

AdaptIQ is a full-stack web application designed to help students organize their academic workload through personalized study planning, performance tracking, and adaptive learning tools.

The platform combines constraint-based timetable generation with student performance data to support more structured and responsive study routines.

## 1. Project Overview

Students often need to manage multiple subjects, examinations, assignments, and competing academic priorities. Fixed study timetables may become ineffective when students miss sessions, struggle with particular topics, or face changes in availability.

AdaptIQ addresses these challenges by providing a centralized platform for managing academic information and generating personalized weekly study schedules.

The application uses optimization techniques to construct study timetables according to student availability, workload limits, and subject priorities.

Additional features support adaptive quizzes, spaced repetition, progress analytics, and personalized study recommendations.

## 2. Project Objectives

The primary objectives of AdaptIQ are to:

1. Develop a centralized academic planning platform.
2. Generate personalized study schedules using constraint-based optimization.
3. Prioritize subjects using academic performance and examination information.
4. Allow students to monitor completed, partial, and missed study sessions.
5. Support schedule adjustments when planned sessions are missed.
6. Provide adaptive practice quizzes based on previous performance.
7. Incorporate spaced repetition for revision management.
8. Recommend study priorities using recorded learning activity.
9. Provide progress analytics and calendar export functionality.
10. Deliver an accessible and responsive student interface.

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Scheduling service | Python, FastAPI |
| Optimization | Google OR-Tools |
| Authentication | Session-based authentication |
| Calendar integration | iCalendar (.ics) export |
| Backend testing | Vitest |

### Architecture

AdaptIQ consists of three primary application layers:

**React Frontend**

Provides the student interface for managing profiles, subjects, availability, study sessions, quizzes, and learning insights.

**Express Backend**

Handles authentication, API requests, validation, database operations, and communication with the scheduling service.

**Python Scheduling Service**

Uses OR-Tools to generate study schedules based on academic priorities and availability constraints.

PostgreSQL maintains persistent student records, academic information, study plans, session progress, and revision data.

## 4. Implemented Features

### 4.1 User Authentication

- Student registration and login.
- Session-based authentication.
- Authenticated access to student-specific resources.
- Logout functionality.

### 4.2 Student Profiles

Students can configure information including:

- Education level.
- Academic year or class.
- Semester.
- Timezone.
- Academic goals.
- Desired grades.
- Preferred session duration.
- Daily study limits.
- Sleep and study preferences.

### 4.3 Academic Management

Students can manage their academic workload through:

- Subject management.
- Academic assessments and marks.
- Examination information.
- Subject priorities.
- Weekly study availability.

These records provide inputs for the scheduling system.

### 4.4 Personalized Study Scheduling

AdaptIQ generates weekly study timetables using a separate Python scheduling service.

The planner considers:

- Student availability.
- Subject priority scores.
- Daily study limits.
- Subject-level scheduling limits.
- Preferred minimum study-block duration.

Google OR-Tools is used to construct schedules under the configured constraints.

Generated study plans can be stored in PostgreSQL and displayed through the student dashboard.

### 4.5 Study Session Tracking

Each scheduled study session can be marked as:

- Planned.
- Completed.
- Partially completed.
- Missed.

The platform records actual study duration and uses session history to support progress tracking.

### 4.6 Adaptive Recovery

AdaptIQ includes functionality for responding to missed study sessions and adjusting the student's timetable.

This helps students recover from changes to their original study schedule.

### 4.7 Adaptive Quizzes

The platform supports practice quizzes organized by subject and topic.

Quiz difficulty is selected using previous performance:

- Below 50%: Easy.
- 50% to below 80%: Medium.
- 80% and above: Hard.

Question availability can affect the selected difficulty.

Quiz results are recorded for subsequent performance analysis.

### 4.8 Quiz Performance Insights

The quiz analytics feature provides:

- Overall quiz performance.
- Subject-level accuracy.
- Topic-level accuracy.
- Recent quiz attempts.
- Identification of weak topics.

Topics with sufficient answered questions are classified according to their recorded performance.

### 4.9 Spaced Repetition

AdaptIQ incorporates an SM-2-inspired spaced repetition algorithm.

Students can create revision cards for specific subjects and topics.

The application manages:

- Review due dates.
- Recall ratings.
- Review intervals.
- Repetition history.
- Lapses.

Weak quiz topics can also be added to the revision workflow.

### 4.10 Personalized Study Recommendations

AdaptIQ uses a rule-based recommendation engine to identify potential study priorities.

The recommendation system considers four factors:

| Factor | Maximum score |
|---|---:|
| Quiz performance gaps | 40 |
| Due revision cards | 30 |
| Existing planner priority | 20 |
| Weak quiz topics | 10 |
| **Total** | **100** |

Recommendations include priority scores, urgency classifications, and explanations.

These scores represent relative study priorities rather than predictions of academic achievement.

### 4.11 Progress Analytics

The student dashboard and analytics functionality provide information about:

- Planned study duration.
- Recorded study duration.
- Completed sessions.
- Partial sessions.
- Missed sessions.
- Subject-level study activity.
- Historical progress.

### 4.12 Calendar Export

Students can export their current weekly study schedule as an `.ics` file.

The export preserves scheduled dates and times using the student's configured timezone.

Calendar files can be imported into compatible applications such as Google Calendar, Apple Calendar, and Microsoft Outlook.

This is a manual export feature, not continuous calendar synchronization.

### 4.13 Responsive User Interface

The application uses an Espresso and Coral visual design system.

Interface improvements include:

- Grouped desktop navigation.
- Collapsible mobile navigation.
- Responsive weekly timetable.
- Session status controls.
- Form validation feedback.
- Accessible input labels.
- Loading and error messages.

## 5. Study Planning Workflow

The typical student workflow is:

1. Register and log in.
2. Complete the learner profile.
3. Add subjects and academic information.
4. Enter examinations and assessment details.
5. Configure weekly availability.
6. Generate a personalized study timetable.
7. Save the weekly plan.
8. Complete and track study sessions.
9. Use adaptive recovery when sessions are missed.
10. Complete quizzes and review weak topics.
11. Use spaced repetition for scheduled revision.
12. Review personalized recommendations and analytics.
13. Export the timetable to a calendar application.

## 6. Scheduling Approach

The scheduling service uses constraint-based optimization.

The backend derives subject priorities from available academic data and submits them to the Python planner.

The planner attempts to allocate study sessions while respecting configured constraints.

The resulting timetable is returned to the Express backend for validation and persistence.

Schedule generation is subject to feasibility. Insufficient availability or conflicting constraints may prevent a valid timetable from being produced.

## 7. Project Structure

The repository is organized into three main application directories:

```text
adaptIQ/
├── backend/
│   ├── db/
│   │   └── migrations/
│   └── src/
│       ├── lib/
│       ├── middleware/
│       └── routes/
│
├── frontend/
│   └── src/
│       └── components/
│
├── planner/
│   └── main.py
│
└── README.md
```

The backend contains API routes, database helpers, scheduling integration, recommendation logic, and other application services.

The frontend contains React components for the student interface.

The planner directory contains the Python scheduling service.

## 8. Local Development

### Prerequisites

- Node.js and npm.
- Python.
- PostgreSQL.
- Required Node.js dependencies.
- Required Python scheduling dependencies.

A local PostgreSQL database and the appropriate backend environment configuration must be set up before running the application.

### Start the backend

```powershell
cd backend
npm install
npm run dev
```

### Start the frontend

```powershell
cd frontend
npm install
npm run dev
```

### Start the Python planner

From the project root, using the planner's existing Python environment:

```powershell
cd planner
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

The planner URL must match the backend configuration:

```env
PLANNER_URL=http://127.0.0.1:8001
```

For the local setup used during development:

| Service | Port |
|---|---|
| Express API | 4000 |
| Python planner | 8001 |
| Vite frontend | 5173 or another available port |

The frontend port may vary when the default Vite port is already occupied.

### Database setup

The application uses PostgreSQL migrations stored under:

`backend/db/migrations/`

Database credentials and other environment values must be configured locally. Secret values should not be committed to the repository.

## 9. Adaptive Learning Methods

AdaptIQ incorporates several complementary approaches.

**Constraint-based optimization**

Google OR-Tools is used to allocate study sessions according to scheduling constraints and priorities.

**Adaptive quiz selection**

Previous quiz performance influences the difficulty of subsequent practice questions.

**Spaced repetition**

Revision intervals are adjusted using an SM-2-inspired scheduling algorithm.

**Rule-based recommendations**

Study recommendations are generated from quiz results, due reviews, weak topics, and planner priorities.

**Machine-learning research**

The project also includes experimental machine-learning development work. Model development based on synthetic training data should not be interpreted as validated predictive performance on real student populations.

The operational scheduling and recommendation functionality described above does not depend on a validated production machine-learning prediction model.

## 10. Current Limitations

The following limitations should be considered:

- Timetable generation depends on the Python scheduling service being available.
- Highly restrictive availability constraints may prevent schedule generation.
- Calendar export is manual and does not provide continuous synchronization.
- Recommendation scores are heuristic and are not guaranteed measures of learning outcomes.
- Quiz-based insights depend on the amount and quality of recorded quiz data.
- Machine-learning experiments require further evaluation using representative real-world data.
- Full end-to-end integration testing has not been completed.

## 11. Future Enhancements

Potential future improvements include:

- Direct integration with external calendar APIs.
- Additional learning-performance datasets.
- Evaluation of predictive models using real student data.
- More comprehensive automated integration testing.
- Improved accessibility across all application pages.
- Deployment monitoring and operational documentation.

These are future directions rather than completed application features.

## 12. Project Status

The core application features have been implemented, including academic management, scheduling, session tracking, adaptive quizzes, spaced repetition, personalized recommendations, analytics, and calendar export.

Local timetable generation has been restored and verified through manual use.

Some automated unit tests were developed during implementation. However, comprehensive final integration testing and production deployment validation remain outside the completed scope.

ven study support.
