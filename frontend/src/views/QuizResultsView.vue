<template>
  <div class="quiz-results-container">
    <div v-if="!user.isLogged" class="not-logged-in">
      <h1>Wyniki quizu</h1>
      <p>Musisz być zalogowany, aby zobaczyć wyniki.</p>
      <button @click="goLogin" class="login-btn">Przejdź do logowania</button>
    </div>

    <div v-else-if="user.role !== 'instruktor'" class="no-access">
      <h1>Brak dostępu</h1>
      <p>Tylko instruktorzy mogą przeglądać wyniki quizów.</p>
      <button @click="goBack" class="back-btn">Powrót</button>
    </div>

    <div v-else>
      <div class="results-header">
        <h1>Wyniki quizu</h1>
        <button @click="goBack" class="back-btn">← Powrót do grupy</button>
      </div>

      <div class="quiz-info">
        <h2>{{ quizName }}</h2>
        <div class="stats">
          <div class="stat-box">
            <div class="stat-label">Liczba uczestników</div>
            <div class="stat-value">{{ results.length }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Średni wynik</div>
            <div class="stat-value">{{ averageScore }}%</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Najwyższy wynik</div>
            <div class="stat-value">{{ highestScore }}%</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Najniższy wynik</div>
            <div class="stat-value">{{ lowestScore }}%</div>
          </div>
        </div>
      </div>

      <div class="results-list">
        <h3>Szczegółowe wyniki:</h3>
        <table class="results-table">
          <thead>
            <tr>
              <th>Lp.</th>
              <th>Imię i Nazwisko</th>
              <th>Wynik</th>
              <th>Procent</th>
              <th>Data</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(result, index) in results" :key="result.id">
              <td>{{ index + 1 }}</td>
              <td>{{ result.studentName }}</td>
              <td>{{ result.score }}/{{ result.totalQuestions }}</td>
              <td>
                <div class="score-badge" :class="{ 'high': result.percentage >= 70, 'medium': result.percentage >= 50 && result.percentage < 70, 'low': result.percentage < 50 }">
                  {{ result.percentage }}%
                </div>
              </td>
              <td>{{ result.date }}</td>
              <td>
                <button @click="viewDetails(result.id)" class="details-btn">Szczegóły</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selectedResult" class="details-modal">
        <div class="modal-content">
          <button @click="selectedResult = null" class="close-btn">✕</button>
          <h2>Szczegóły wyniku</h2>
          <p><strong>Uczeń:</strong> {{ selectedResult.studentName }}</p>
          <p><strong>Wynik:</strong> {{ selectedResult.score }}/{{ selectedResult.totalQuestions }} ({{ selectedResult.percentage }}%)</p>
          <p><strong>Data:</strong> {{ selectedResult.date }}</p>
          <p><strong>Czas rozwiązywania:</strong> {{ selectedResult.duration }} minut</p>
          
          <div class="answers-review">
            <h3>Przejrzenie odpowiedzi:</h3>
            <div v-for="(answer, index) in selectedResult.answers" :key="index" class="answer-review">
              <h4>Pytanie {{ index + 1 }}: {{ answer.question }}</h4>
              <p><strong>Odpowiedź ucznia:</strong> <span :class="{ 'correct': answer.correct, 'incorrect': !answer.correct }">{{ answer.studentAnswer }}</span></p>
              <p v-if="!answer.correct"><strong>Prawidłowa odpowiedź:</strong> {{ answer.correctAnswer }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { user } from '../store/user.js'

const router = useRouter()
const route = useRoute()

const quizName = computed(() => route.query.quizName || 'Quiz bez tytułu')
const groupName = computed(() => route.params.groupName)
const selectedResult = ref(null)

// Mock results data
const results = ref([
  {
    id: 1,
    studentName: 'Anna Kowalski',
    score: 28,
    totalQuestions: 40,
    percentage: 70,
    date: '25.03.2026 14:30',
    duration: 45,
    answers: [
      { question: 'Ile wynosi 2 + 2?', studentAnswer: '4', correctAnswer: '4', correct: true },
      { question: 'Które z poniższych są liczbami pierwszymi?', studentAnswer: '2, 3, 5', correctAnswer: '2, 3, 5', correct: true },
      { question: 'Jaka jest stolica Polski?', studentAnswer: 'Kraków', correctAnswer: 'Warszawa', correct: false }
    ]
  },
  {
    id: 2,
    studentName: 'Jan Nowak',
    score: 35,
    totalQuestions: 40,
    percentage: 88,
    date: '25.03.2026 15:15',
    duration: 52,
    answers: [
      { question: 'Ile wynosi 2 + 2?', studentAnswer: '4', correctAnswer: '4', correct: true },
      { question: 'Które z poniższych są liczbami pierwszymi?', studentAnswer: '2, 3, 5', correctAnswer: '2, 3, 5', correct: true },
      { question: 'Jaka jest stolica Polski?', studentAnswer: 'Warszawa', correctAnswer: 'Warszawa', correct: true }
    ]
  },
  {
    id: 3,
    studentName: 'Maria Lewandowska',
    score: 30,
    totalQuestions: 40,
    percentage: 75,
    date: '25.03.2026 16:00',
    duration: 48,
    answers: [
      { question: 'Ile wynosi 2 + 2?', studentAnswer: '4', correctAnswer: '4', correct: true },
      { question: 'Które z poniższych są liczbami pierwszymi?', studentAnswer: '2, 3, 4, 5', correctAnswer: '2, 3, 5', correct: false },
      { question: 'Jaka jest stolica Polski?', studentAnswer: 'Warszawa', correctAnswer: 'Warszawa', correct: true }
    ]
  },
  {
    id: 4,
    studentName: 'Piotr Szymańskiej',
    score: 16,
    totalQuestions: 40,
    percentage: 40,
    date: '24.03.2026 13:45',
    duration: 38,
    answers: [
      { question: 'Ile wynosi 2 + 2?', studentAnswer: '3', correctAnswer: '4', correct: false },
      { question: 'Które z poniższych są liczbami pierwszymi?', studentAnswer: '2, 4', correctAnswer: '2, 3, 5', correct: false },
      { question: 'Jaka jest stolica Polski?', studentAnswer: 'Kraków', correctAnswer: 'Warszawa', correct: false }
    ]
  }
])

const averageScore = computed(() => {
  if (results.value.length === 0) return 0
  const sum = results.value.reduce((acc, r) => acc + r.percentage, 0)
  return Math.round(sum / results.value.length)
})

const highestScore = computed(() => {
  if (results.value.length === 0) return 0
  return Math.max(...results.value.map(r => r.percentage))
})

const lowestScore = computed(() => {
  if (results.value.length === 0) return 0
  return Math.min(...results.value.map(r => r.percentage))
})

function viewDetails(resultId) {
  selectedResult.value = results.value.find(r => r.id === resultId)
}

function goBack() {
  router.push(`/group/${groupName.value}`)
}

function goLogin() {
  router.push('/')
}
</script>

<style scoped>
.quiz-results-container {
  max-width: 1000px;
  margin: 20px auto;
  padding: 20px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #eee;
}

.back-btn {
  padding: 8px 16px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.quiz-info {
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.quiz-info h2 {
  margin-top: 0;
  margin-bottom: 20px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.stat-box {
  background-color: white;
  padding: 15px;
  border-radius: 6px;
  text-align: center;
  border: 1px solid #ddd;
}

.stat-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #007bff;
}

.results-list {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
}

.results-list h3 {
  margin-top: 0;
  margin-bottom: 20px;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.results-table thead {
  background-color: #f0f0f0;
}

.results-table th {
  padding: 12px;
  text-align: left;
  font-weight: bold;
  border-bottom: 2px solid #ddd;
}

.results-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.results-table tbody tr:hover {
  background-color: #f9f9f9;
}

.score-badge {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 20px;
  font-weight: bold;
  color: white;
}

.score-badge.high {
  background-color: #28a745;
}

.score-badge.medium {
  background-color: #ffc107;
  color: #333;
}

.score-badge.low {
  background-color: #dc3545;
}

.details-btn {
  padding: 6px 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.details-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 15px;
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: 20px;
}

.modal-content p {
  margin-bottom: 10px;
}

.answers-review {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #eee;
}

.answer-review {
  margin-bottom: 15px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 6px;
}

.answer-review h4 {
  margin-top: 0;
  margin-bottom: 8px;
}

.answer-review p {
  margin: 5px 0;
  font-size: 14px;
}

.correct {
  color: #28a745;
  font-weight: bold;
}

.incorrect {
  color: #dc3545;
  font-weight: bold;
}

.not-logged-in,
.no-access {
  text-align: center;
  margin-top: 50px;
}

.login-btn {
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}
</style>