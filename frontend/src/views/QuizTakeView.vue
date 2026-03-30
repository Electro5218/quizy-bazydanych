<template>
  <div class="quiz-take-container">
    <div v-if="!user.isLogged" class="not-logged-in">
      <h1>Quiz</h1>
      <p>Musisz być zalogowany, aby rozwiązać quiz.</p>
      <button @click="goLogin" class="login-btn">Przejdź do logowania</button>
    </div>

    <div v-else>
      <div class="quiz-header">
        <h1>{{ quizName }}</h1>
        <div class="timer" v-if="timeRemaining > 0">
          <span>Czas: {{ formatTime(timeRemaining) }}</span>
        </div>
        <div class="timer-expired" v-else>
          <span>Czas upłynął!</span>
        </div>
      </div>

      <div v-if="currentQuestionIndex < questions.length" class="quiz-content">
        <div class="progress">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: ((currentQuestionIndex + 1) / questions.length * 100) + '%' }"
            ></div>
          </div>
          <span class="progress-text">Pytanie {{ currentQuestionIndex + 1 }} z {{ questions.length }}</span>
        </div>

        <div class="question-box">
          <h3>{{ questions[currentQuestionIndex].text }}</h3>

          <div class="answers">
            <label 
              v-for="(answer, index) in questions[currentQuestionIndex].answers" 
              :key="index"
              class="answer-option"
            >
              <input 
                v-model="studentAnswers[currentQuestionIndex]" 
                :value="answer.text"
                :type="questions[currentQuestionIndex].type === 'single' ? 'radio' : 'checkbox'"
                :name="`question-${currentQuestionIndex}`"
              />
              <span>{{ answer.text }}</span>
            </label>
          </div>
        </div>

        <div class="navigation">
          <button 
            @click="previousQuestion" 
            :disabled="currentQuestionIndex === 0"
            class="nav-btn"
          >
            Poprzednie
          </button>
          <button 
            v-if="currentQuestionIndex < questions.length - 1"
            @click="nextQuestion"
            class="nav-btn"
          >
            Następne
          </button>
          <button 
            v-else
            @click="submitQuiz"
            class="submit-btn"
          >
            Wyślij zanim
          </button>
        </div>
      </div>

      <div v-else class="quiz-completed">
        <h2>Quiz ukończony!</h2>
        <p>Twój wynik: <strong>{{ quizResult }}/{{ questions.length }}</strong></p>
        <p>Procent: <strong>{{ Math.round(quizResult / questions.length * 100) }}%</strong></p>
        <button @click="goBack" class="back-btn">Powrót do grupy</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { user } from '../store/user.js'

const router = useRouter()
const route = useRoute()

const quizName = computed(() => route.query.quizName || 'Quiz bez tytułu')
const groupName = computed(() => route.params.groupName)

const currentQuestionIndex = ref(0)
const studentAnswers = ref([])
const timeRemaining = ref(1800) // 30 minutes in seconds
const quizResult = ref(0)
const quizSubmitted = ref(false)
let timerInterval = null

// Mock quiz data
const questions = ref([
  {
    id: 1,
    type: 'single',
    text: 'Ile wynosi 2 + 2?',
    answers: [
      { text: '3', correct: false },
      { text: '4', correct: true },
      { text: '5', correct: false }
    ]
  },
  {
    id: 2,
    type: 'multiple',
    text: 'Które z poniższych są liczbami pierwszymi?',
    answers: [
      { text: '2', correct: true },
      { text: '3', correct: true },
      { text: '4', correct: false },
      { text: '5', correct: true }
    ]
  },
  {
    id: 3,
    type: 'single',
    text: 'Jaka jest stolica Polski?',
    answers: [
      { text: 'Kraków', correct: false },
      { text: 'Warszawa', correct: true },
      { text: 'Gdańsk', correct: false },
      { text: 'Wrocław', correct: false }
    ]
  }
])

onMounted(() => {
  // Initialize answers array
  studentAnswers.value = new Array(questions.value.length).fill(null)
  
  // Start timer
  timerInterval = setInterval(() => {
    timeRemaining.value--
    if (timeRemaining.value <= 0) {
      clearInterval(timerInterval)
      submitQuiz()
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
})

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

function previousQuestion() {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
  }
}

function nextQuestion() {
  if (currentQuestionIndex.value < questions.value.length - 1) {
    currentQuestionIndex.value++
  }
}

function submitQuiz() {
  // Calculate score
  let score = 0
  questions.value.forEach((question, index) => {
    const studentAnswer = studentAnswers.value[index]
    const correctAnswer = question.answers.find(a => a.correct)
    if (studentAnswer === correctAnswer.text) {
      score++
    }
  })
  
  quizResult.value = score
  quizSubmitted.value = true
}

function goBack() {
  router.push(`/group/${groupName.value}`)
}

function goLogin() {
  router.push('/')
}
</script>

<style scoped>
.quiz-take-container {
  max-width: 700px;
  margin: 20px auto;
  padding: 20px;
}

.quiz-header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #eee;
}

.timer {
  margin-top: 10px;
  font-size: 18px;
  color: #28a745;
  font-weight: bold;
}

.timer-expired {
  margin-top: 10px;
  font-size: 18px;
  color: #dc3545;
  font-weight: bold;
}

.quiz-content {
  background-color: #f9f9f9;
  padding: 30px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.progress {
  margin-bottom: 30px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background-color: #007bff;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  color: #666;
}

.question-box {
  margin-bottom: 30px;
}

.question-box h3 {
  font-size: 18px;
  margin-bottom: 20px;
  color: #333;
}

.answers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answer-option {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.answer-option:hover {
  background-color: #f0f0f0;
}

.answer-option input {
  margin-right: 10px;
  cursor: pointer;
}

.answer-option span {
  cursor: pointer;
}

.navigation {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  margin-top: 20px;
}

.nav-btn, .submit-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.nav-btn {
  background-color: #6c757d;
  color: white;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-btn {
  background-color: #28a745;
  color: white;
  flex-grow: 1;
}

.quiz-completed {
  text-align: center;
  padding: 40px 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.quiz-completed h2 {
  color: #28a745;
  margin-bottom: 20px;
}

.quiz-completed p {
  font-size: 18px;
  margin-bottom: 10px;
  color: #333;
}

.back-btn {
  margin-top: 20px;
  padding: 10px 20px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
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
</style>