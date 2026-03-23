# 🎓 Quiz Platform (E-learning System)

A relational database-driven online quiz platform designed for educational environments. The system enables instructors to create quizzes and analyze results while allowing students to participate and track their progress.

---

## 📌 Project Goal

The goal of this project is to build a **robust, consistent, and secure database system** that supports e-learning processes, with emphasis on:

* data integrity
* protection against race conditions
* prevention of cheating
* efficient querying and analytics

---

## 👥 User Roles

### 🎓 Students

* Solve quizzes assigned to groups
* Join groups using invite codes
* View their results and history

### 👨‍🏫 Instructors

* Create and manage quizzes
* Manage student groups
* Analyze performance and results

---

## 🧱 Tech Stack

### Backend

* Node.js
* Express
* PostgreSQL
* node-postgres (raw SQL, no ORM)

### Frontend

* Vue.js

---

## 🏗️ Architecture

Frontend (Vue) → Backend (Node.js/Express) → PostgreSQL Database

* Frontend: UI and API communication
* Backend: request handling + SQL execution
* Database: data storage and integrity

Backend acts as a **thin layer** executing direct SQL queries.

---

## 🗄️ Database Structure

Main tables:

* `users`
* `groups`
* `group_users`
* `quizzes`
* `questions`
* `answers`
* `quiz_attempts`
* `user_answers`

---

## 🚀 Features

### 🔐 Authentication

* Registration
* Login
* Password reset (token-based)
* Account update
* Soft delete account
* Account blocking

### 👥 Groups

* Create groups
* Join via code or invite
* Manage members

### 📝 Quizzes

* Create quizzes
* Edit quizzes
* Multiple question types
* Time limits & attempt limits

### 📊 Results & Analytics

* Attempt history
* Group statistics
* Difficulty analysis

---

## 🔒 Security

* Password hashing
* Token expiration (password reset)
* Soft delete (data consistency)
* Login attempt limits
* Account blocking system

---

## ⚙️ Installation

```bash
git clone https://github.com/your-repo/quiz-platform.git
cd quiz-platform
npm install
```

### Run backend

```bash
cd backend
npm run dev
```

### Run frontend

```bash
cd frontend
npm run serve
```

---

## 📡 Example API Endpoints

* POST /auth/register
* POST /auth/login
* POST /auth/reset-password
* GET /quizzes
* POST /quizzes
* POST /attempts

---

## 📈 Future Improvements

* Leaderboards
* Email notifications
* CSV export
* Advanced analytics dashboard

---

## 👨‍💻 Authors

* Paweł Jamroziak
* Dominik Baryła
* Karolina Bieńko

---

## 📄 License

MIT
