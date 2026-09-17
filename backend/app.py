"""
Student Management System - Backend
Flask + SQLAlchemy + SQLite REST API

Endpoints:
  GET    /api/students          -> list all students (supports ?search=&department=&year=)
  GET    /api/students/<id>     -> get one student
  POST   /api/students          -> create a student
  PUT    /api/students/<id>     -> update a student
  DELETE /api/students/<id>     -> delete a student
  GET    /api/health            -> health check
"""

import os
import re
from datetime import datetime

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "students.db")

app = Flask(__name__)
CORS(app)  # allow the static frontend (different origin/port) to call this API
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^\d{10}$")
VALID_YEARS = {1, 2, 3, 4}


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    roll_no = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(80), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(10), nullable=True)
    cgpa = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "roll_no": self.roll_no,
            "name": self.name,
            "department": self.department,
            "year": self.year,
            "email": self.email,
            "phone": self.phone,
            "cgpa": self.cgpa,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_payload(data, partial=False):
    """Returns a list of error strings. Empty list = valid."""
    errors = []
    required = ["roll_no", "name", "department", "year"]

    if not partial:
        for field in required:
            if not str(data.get(field, "")).strip():
                errors.append(f"'{field}' is required.")

    if "name" in data and data["name"] is not None and not str(data["name"]).strip():
        errors.append("'name' cannot be empty.")

    if "roll_no" in data and data["roll_no"] is not None and not str(data["roll_no"]).strip():
        errors.append("'roll_no' cannot be empty.")

    if "email" in data and data["email"]:
        if not EMAIL_RE.match(str(data["email"]).strip()):
            errors.append("'email' is not a valid email address.")
    elif not partial and "email" in required:
        pass  # email not strictly required in `required`, kept optional-safe below

    if "phone" in data and data["phone"]:
        if not PHONE_RE.match(str(data["phone"]).strip()):
            errors.append("'phone' must be exactly 10 digits.")

    if "year" in data and data["year"] not in (None, ""):
        try:
            y = int(data["year"])
            if y not in VALID_YEARS:
                errors.append("'year' must be between 1 and 4.")
        except (ValueError, TypeError):
            errors.append("'year' must be a whole number.")

    if "cgpa" in data and data["cgpa"] not in (None, ""):
        try:
            c = float(data["cgpa"])
            if c < 0 or c > 10:
                errors.append("'cgpa' must be between 0 and 10.")
        except (ValueError, TypeError):
            errors.append("'cgpa' must be a number.")

    return errors


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@app.route("/api/students", methods=["GET"])
def list_students():
    query = Student.query

    search = request.args.get("search", "").strip()
    department = request.args.get("department", "").strip()
    year = request.args.get("year", "").strip()

    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(Student.name.ilike(like), Student.roll_no.ilike(like))
        )
    if department:
        query = query.filter(Student.department.ilike(f"%{department}%"))
    if year:
        try:
            query = query.filter(Student.year == int(year))
        except ValueError:
            return jsonify({"error": "'year' filter must be a number."}), 400

    students = query.order_by(Student.name.asc()).all()
    return jsonify([s.to_dict() for s in students]), 200


@app.route("/api/students/<int:student_id>", methods=["GET"])
def get_student(student_id):
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"error": "Student not found."}), 404
    return jsonify(student.to_dict()), 200


@app.route("/api/students", methods=["POST"])
def create_student():
    data = request.get_json(silent=True) or {}
    errors = validate_payload(data, partial=False)
    if errors:
        return jsonify({"errors": errors}), 400

    student = Student(
        roll_no=str(data["roll_no"]).strip(),
        name=str(data["name"]).strip(),
        department=str(data["department"]).strip(),
        year=int(data["year"]),
        email=str(data.get("email", "")).strip() or None,
        phone=str(data.get("phone", "")).strip() or None,
        cgpa=float(data["cgpa"]) if data.get("cgpa") not in (None, "") else None,
    )

    db.session.add(student)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"errors": ["A student with this roll number or email already exists."]}), 409

    return jsonify(student.to_dict()), 201


@app.route("/api/students/<int:student_id>", methods=["PUT", "PATCH"])
def update_student(student_id):
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"error": "Student not found."}), 404

    data = request.get_json(silent=True) or {}
    errors = validate_payload(data, partial=True)
    if errors:
        return jsonify({"errors": errors}), 400

    if "roll_no" in data:
        student.roll_no = str(data["roll_no"]).strip()
    if "name" in data:
        student.name = str(data["name"]).strip()
    if "department" in data:
        student.department = str(data["department"]).strip()
    if "year" in data and data["year"] not in (None, ""):
        student.year = int(data["year"])
    if "email" in data:
        student.email = str(data["email"]).strip() or None
    if "phone" in data:
        student.phone = str(data["phone"]).strip() or None
    if "cgpa" in data:
        student.cgpa = float(data["cgpa"]) if data["cgpa"] not in (None, "") else None

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"errors": ["A student with this roll number or email already exists."]}), 409

    return jsonify(student.to_dict()), 200


@app.route("/api/students/<int:student_id>", methods=["DELETE"])
def delete_student(student_id):
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"error": "Student not found."}), 404

    db.session.delete(student)
    db.session.commit()
    return jsonify({"message": f"Student {student_id} deleted."}), 200


@app.errorhandler(404)
def not_found(_e):
    return jsonify({"error": "Resource not found."}), 404


@app.errorhandler(500)
def server_error(_e):
    return jsonify({"error": "Internal server error."}), 500


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(debug=True, port=5000)
