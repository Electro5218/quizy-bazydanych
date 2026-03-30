<template>
  <div class="group-container">
    <div v-if="!user.isLogged" class="not-logged-in">
      <h1>Grupa</h1>
      <p>Musisz być zalogowany, aby zobaczyć szczegóły grupy.</p>
      <button @click="goLogin" class="login-btn">Przejdź do logowania</button>
    </div>

    <div v-else>
      <div class="header">
        <h1>Grupa: {{ groupName }}</h1>
        <button @click="goBack" class="back-btn">← Powrót do grup</button>
      </div>

      <!-- Instructor View -->
      <div v-if="user.role === 'instruktor'" class="instruktor-view">
        <div class="instructor-actions">
          <button @click="showCreateQuizForm = true" class="create-quiz-btn">Stwórz nowy quiz</button>
        </div>

        <h3>Quizy w tej grupie:</h3>
        <div v-if="quizzes.length > 0" class="quizzes-list">
          <div v-for="quiz in quizzes" :key="quiz.id" class="quiz-card">
            <div class="quiz-info">
              <h4>{{ quiz.name }}</h4>
              <p>{{ quiz.description }}</p>
              <p class="quiz-stats">Liczba uczestników: <strong>{{ quiz.participants }}</strong></p>
            </div>
            <button @click="openQuizResults(quiz.id)" class="view-results-btn">Pokaż wyniki</button>
          </div>
        </div>
        <p v-else class="no-content">Brak quizów w tej grupie. Stwórz nowy!</p>
      </div>

      <!-- Student View -->
      <div v-else-if="user.role === 'uczen'" class="uczen-view">
        <h3>Dostępne quizy:</h3>
        <div v-if="availableQuizzes.length > 0" class="quizzes-list">
          <div v-for="quiz in availableQuizzes" :key="quiz.id" class="quiz-card">
            <div class="quiz-info">
              <h4>{{ quiz.name }}</h4>
              <p>{{ quiz.description }}</p>
              <p class="quiz-meta">
                <span>Ilość prób: {{ quiz.attempts }}</span>
                <span>Czas: {{ quiz.timeLimit }} min</span>
              </p>
            </div>
            <button @click="startQuiz(quiz.id)" class="take-quiz-btn">Rozwiąż quiz</button>
          </div>
        </div>
        <p v-else class="no-content">Brak dostępnych quizów w tej grupie.</p>
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
const showCreateQuizForm = ref(false)

const groupName = computed(() => route.params.name)

// Mock data for quizzes
const quizzes = ref([
  {
    id: 1,
    name: 'Quiz Matematyka - Podstawy',
    description: 'Quiz obejmujący podstawy matematyki',
    participants: 23,
    visible: true,
    attempts: 3,
    timeLimit: 45
  },
  {
    id: 2,
    name: 'Quiz Algebra',
    description: 'Test wiedzy z algebry',
    participants: 18,
    visible: true,
    attempts: 2,
    timeLimit: 60
  }
])

const availableQuizzes = computed(() => quizzes.value.filter(q => q.visible))

function goBack() {
  router.push('/groups')
}

function goLogin() {
  router.push('/')
}

function startQuiz(quizId) {
  const quiz = quizzes.value.find(q => q.id === quizId)
  if (quiz) {
    router.push({
      name: 'quiz-view',
      params: { groupName: groupName.value, quizId: quizId },
      query: { quizName: quiz.name }
    })
  }
}

function openQuizResults(quizId) {
  router.push({
    name: 'quiz-results',
    params: { groupName: groupName.value, quizId: quizId }
  })
}
</script>

<style scoped>
.group-container {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
}

.header {
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

.instructor-actions {
  margin-bottom: 30px;
}

.create-quiz-btn {
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.quizzes-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.quiz-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.quiz-info {
  flex: 1;
}

.quiz-info h4 {
  margin: 0 0 5px 0;
  font-size: 18px;
}

.quiz-info p {
  margin: 5px 0;
  font-size: 14px;
  color: #666;
}

.quiz-stats {
  margin-top: 8px;
  font-weight: 500;
  color: #333;
}

.quiz-meta {
  font-size: 13px;
  color: #888;
}

.quiz-meta span {
  margin-right: 15px;
}

.take-quiz-btn, .view-results-btn {
  padding: 10px 20px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  margin-left: 15px;
}

.view-results-btn {
  background-color: #17a2b8;
}

.take-quiz-btn:hover {
  background-color: #218838;
}

.view-results-btn:hover {
  background-color: #138496;
}

.not-logged-in {
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

.no-content {
  text-align: center;
  padding: 30px;
  color: #999;
  font-style: italic;
}
</style>