#!/usr/bin/env bash
# Manual API test pass for the Student Management System backend.
# Run this with the Flask server already running on port 5000:
#   python app.py   (in one terminal)
#   bash test_api.sh (in another)

BASE="http://127.0.0.1:5000/api"

echo "== health =="
curl -s "$BASE/health"; echo

echo -e "\n== create valid student =="
curl -s -X POST "$BASE/students" -H "Content-Type: application/json" \
  -d '{"roll_no":"21ECE001","name":"Arun Kumar","department":"ECE","year":2,"cgpa":8.5,"email":"arun@vsb.edu","phone":"9876543210"}'; echo

echo -e "\n== create: missing required fields =="
curl -s -X POST "$BASE/students" -H "Content-Type: application/json" -d '{"name":"NoRoll"}'; echo

echo -e "\n== create: invalid email =="
curl -s -X POST "$BASE/students" -H "Content-Type: application/json" \
  -d '{"roll_no":"21ECE002","name":"Bad Email","department":"ECE","year":2,"email":"not-an-email"}'; echo

echo -e "\n== create: duplicate roll number =="
curl -s -X POST "$BASE/students" -H "Content-Type: application/json" \
  -d '{"roll_no":"21ECE001","name":"Dup","department":"ECE","year":1}'; echo

echo -e "\n== create: cgpa out of range =="
curl -s -X POST "$BASE/students" -H "Content-Type: application/json" \
  -d '{"roll_no":"21ECE003","name":"C","department":"ECE","year":1,"cgpa":11}'; echo

echo -e "\n== create: invalid phone =="
curl -s -X POST "$BASE/students" -H "Content-Type: application/json" \
  -d '{"roll_no":"21ECE004","name":"P","department":"ECE","year":1,"phone":"123"}'; echo

echo -e "\n== create second student (for search/filter) =="
curl -s -X POST "$BASE/students" -H "Content-Type: application/json" \
  -d '{"roll_no":"21CSE010","name":"Divya R","department":"CSE","year":3,"cgpa":9.1,"email":"divya@vsb.edu","phone":"9123456780"}'; echo

echo -e "\n== list all =="
curl -s "$BASE/students"; echo

echo -e "\n== search by name =="
curl -s "$BASE/students?search=arun"; echo

echo -e "\n== filter by department =="
curl -s "$BASE/students?department=CSE"; echo

echo -e "\n== filter by year =="
curl -s "$BASE/students?year=2"; echo

echo -e "\n== read one (valid id=1) =="
curl -s "$BASE/students/1"; echo

echo -e "\n== read one (invalid id=999) — expect 404 =="
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/students/999"

echo -e "\n== update (valid, partial) =="
curl -s -X PUT "$BASE/students/1" -H "Content-Type: application/json" -d '{"cgpa":9.0}'; echo

echo -e "\n== update (invalid cgpa) =="
curl -s -X PUT "$BASE/students/1" -H "Content-Type: application/json" -d '{"cgpa":15}'; echo

echo -e "\n== delete (valid id=2) =="
curl -s -X DELETE "$BASE/students/2"; echo

echo -e "\n== delete (invalid id=999) — expect 404 =="
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$BASE/students/999"

echo -e "\nAll test cases executed."
