# Student Management System

A full-stack CRUD web application for managing student records, built to the
CRUD Web Application SOP (frontend, REST API, database, validation, testing).

## Overview

Lets a department maintain a "register" of students: add, view, search,
filter, edit, and remove records, backed by a real database through a REST
API.

## Problem Statement

Departments track students across roll number, department, year, CGPA and
contact details, often in a spreadsheet that's easy to corrupt and hard to
search. This app gives that data a proper backend with validation and a fast
searchable interface.

## Tech Stack

| Layer            | Technology                          |
|-------------------|--------------------------------------|
| Frontend          | HTML, CSS, vanilla JavaScript (no build step) |
| Backend            | Python, Flask, Flask-RESTful routing |
| ORM                | Flask-SQLAlchemy                    |
| Database           | SQLite (`backend/students.db`, auto-created) |
| Cross-origin       | Flask-CORS                          |
| API testing        | curl / Postman                      |

## Architecture

```
Browser (index.html + script.js)
        │  fetch() → JSON
        ▼
Flask REST API (app.py)
        │  SQLAlchemy ORM
        ▼
SQLite database (students.db)
```

The frontend is fully static (no npm/build step) and can be opened directly
or served by any static file server. It talks to the Flask API over HTTP,
configured in `frontend/config.js`.

## Database Schema

**Table: `students`**

| Column      | Type    | Constraints                  |
|-------------|---------|-------------------------------|
| id          | Integer | Primary key, autoincrement    |
| roll_no     | String  | Unique, required               |
| name        | String  | Required                       |
| department  | String  | Required                       |
| year        | Integer | Required, 1–4                  |
| email       | String  | Optional, unique, valid format |
| phone       | String  | Optional, 10 digits            |
| cgpa        | Float   | Optional, 0.00–10.00           |
| created_at  | DateTime| Auto-set on creation            |
| updated_at  | DateTime| Auto-updated on edit             |

## Setup & Run

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The API starts on **http://127.0.0.1:5000**. The SQLite database file
(`students.db`) is created automatically on first run — no manual database
setup needed.

Verify it's running:
```bash
curl http://127.0.0.1:5000/api/health
# {"status": "ok"}
```

### 2. Frontend

The frontend is plain static files — no install step. From the `frontend/`
folder, either:

- Open `index.html` directly in a browser, **or**
- Serve it (recommended, avoids browser file:// quirks):
  ```bash
  cd frontend
  python3 -m http.server 8000
  ```
  then visit **http://127.0.0.1:8000**

By default `frontend/config.js` points at `http://127.0.0.1:5000/api`. Change
`API_BASE_URL` there if your backend runs elsewhere.

> Keep both the backend (port 5000) and the static server (port 8000)
> running at the same time.

## REST API Reference

| Operation | Method | Endpoint               | Notes                          |
|-----------|--------|-------------------------|----------------------------------|
| List      | GET    | `/api/students`         | Supports `?search=&department=&year=` |
| Read one  | GET    | `/api/students/<id>`    | 404 if not found                 |
| Create    | POST   | `/api/students`         | Validates required fields, formats |
| Update    | PUT    | `/api/students/<id>`    | Partial updates supported        |
| Delete    | DELETE | `/api/students/<id>`    | 404 if not found                 |
| Health    | GET    | `/api/health`           | Basic uptime check                |

**Example — create a student**
```bash
curl -X POST http://127.0.0.1:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{"roll_no":"21ECE001","name":"Arun Kumar","department":"ECE","year":2,"cgpa":8.5,"email":"arun@vsb.edu","phone":"9876543210"}'
```

**Example — search + filter**
```bash
curl "http://127.0.0.1:5000/api/students?search=arun&department=ECE&year=2"
```

## Validation Rules

- `roll_no`, `name`, `department`, `year` are required.
- `year` must be an integer 1–4.
- `email`, if provided, must match a standard email format and is unique.
- `phone`, if provided, must be exactly 10 digits.
- `cgpa`, if provided, must be between 0 and 10.
- `roll_no` is unique — duplicate creation returns `409 Conflict`.
- All rules are enforced server-side (source of truth) and mirrored
  client-side for instant feedback.

## Testing

A full manual test pass (see `backend/test_api.sh`) covers:

- Create with valid data, missing fields, invalid email, invalid phone,
  out-of-range CGPA, and duplicate roll number.
- Read all, read one (valid and non-existent ID).
- Update (valid and invalid data).
- Delete (valid and non-existent ID).
- Search and filter combinations.

Run it (with the backend already running on port 5000):
```bash
cd backend
bash test_api.sh
```

## Project Structure

```
student-management-system/
├── backend/
│   ├── app.py             # Flask app, models, routes, validation
│   ├── requirements.txt
│   ├── test_api.sh        # Manual API test script
│   └── students.db        # Created automatically on first run
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── config.js          # API_BASE_URL setting
└── README.md
```

## Future Enhancements

- Authentication (staff login) and role-based access.
- Pagination for large student lists.
- CSV import/export.
- Attendance and marks modules linked to each student record.

## Challenges & Solutions

- **Cross-origin requests**: the static frontend and Flask API run on
  different ports during local development — solved with `flask-cors`.
- **Partial updates**: `PUT` accepts partial payloads so the frontend can
  send only changed fields without needing a full record round-trip.
