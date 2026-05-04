<template>
  <div class="quiz-take-container">
    <div v-if="loading">Ładowanie quizu...</div>
    <div v-else-if="error" style="color:red;text-align:center;margin-top:50px">{{ error }}</div>
    <div v-else>
      <div class="quiz-header">
        <h1>{{ quizData.title }}</h1>
        <div class="timer" :class="{ expired: timeRemaining <= 0 }" v-if="quizData.time_limit_sec">
          {{ timeRemaining > 0 ? 'Czas: ' + formatTime(timeRemaining) : 'Czas upłynął!' }}
        </div>
      </div>

      <div v-if="!submitted" class="quiz-content">
        <div class="progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: ((currentIndex + 1) / questions.length * 100) + '%' }"></div>
          </div>
          <span>Pytanie {{ currentIndex + 1 }} z {{ questions.length }}</span>
        </div>

        <div class="question-box">
          <h3>{{ questions[currentIndex].content }}</h3>
          <div class="answers">
            <label v-for="answer in questions[currentIndex].answers" :key="answer.id" class="answer-option">
              <input
                v-model="studentAnswers[currentIndex]"
                :value="answer.id"
                :type="questions[currentIndex].question_type === 'single' ? 'radio' : 'checkbox'"
                :name="`q-${currentIndex}`"
              />
              <span>{{ answer.content }}</span>
            </label>
          </div>
        </div>

        <div class="navigation">
          <button @click="currentIndex--" :disabled="currentIndex === 0" class="nav-btn">Poprzednie</button>
          <button v-if="currentIndex < questions.length - 1" @click="saveAndNext" class="nav-btn">Następne</button>
          <button v-else @click="submitQuiz" class="submit-btn">Zakończ quiz</button>
        </div>
      </div>

      <div v-else class="quiz-completed">
        <h2>Quiz ukończony!</h2>
        <p>Wynik: <strong>{{ result.score }} / {{ result.total_questions }}</strong></p>
        <p>Procent: <strong>{{ result.percentage }}%</strong></p>
        <button @click="router.push(`/group/${route.params.groupName}`)" class="back-btn">Powrót do grupy</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { user } from '../store/user.js'
import api from '../api/index.js'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const error = ref('')
const submitted = ref(false)
const quizData = ref({})
const questions = ref([])
const currentIndex = ref(0)
const studentAnswers = ref([])
const timeRemaining = ref(0)
const result = ref({})
const attemptId = ref(null)
let timerInterval = null

onMounted(async () => {
  try {
    const { data } = await api.post('/attempts', { quiz_id: parseInt(route.params.quizId) })
    attemptId.value = data.attempt.id
    quizData.value = data.quiz
    questions.value = data.questions
    studentAnswers.value = data.questions.map(q => q.question_type === 'multiple' ? [] : null)

    if (data.quiz.time_limit_sec) {
      timeRemaining.value = data.quiz.time_limit_sec
      timerInterval = setInterval(() => {
        timeRemaining.value--
        if (timeRemaining.value <= 0) {
          clearInterval(timerInterval)
          submitQuiz()
        }
      }, 1000)
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Błąd ładowania quizu'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => { if (timerInterval) clearInterval(timerInterval) })

function formatTime(s) {
  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
}

async function saveAndNext() {
  await saveCurrentAnswer()
  currentIndex.value++
}

async function saveCurrentAnswer() {
  const ans = studentAnswers.value[currentIndex.value]
  if (!ans || (Array.isArray(ans) && !ans.length)) return
  const ids = Array.isArray(ans) ? ans : [ans]
  await api.post(`/attempts/${attemptId.value}/answers`, {
    question_id: questions.value[currentIndex.value].id,
    answer_ids: ids
  })
}

async function submitQuiz() {
  await saveCurrentAnswer()
  try {
    const { data } = await api.post(`/attempts/${attemptId.value}/finish`)
    result.value = data
    submitted.value = true
  } catch (err) {
    error.value = 'Błąd zakończenia quizu'
  }
}
</script>

<style scoped>
.quiz-take-container { max-width: 700px; margin: 20px auto; padding: 20px; }
.quiz-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
.timer { font-size: 18px; color: #28a745; font-weight: bold; margin-top: 10px; }
.timer.expired { color: #dc3545; }
.progress { margin-bottom: 30px; }
.progress-bar { width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; margin-bottom: 10px; }
.progress-fill { height: 100%; background: #007bff; border-radius: 4px; transition: width 0.3s; }
.question-box h3 { font-size: 18px; margin-bottom: 20px; }
.answers { display: flex; flex-direction: column; gap: 12px; }
.answer-option { display: flex; align-items: center; padding: 12px; background: white; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; gap: 10px; }
.answer-option:hover { background: #f0f0f0; }
.navigation { display: flex; gap: 10px; margin-top: 20px; }
.nav-btn { padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
.nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.submit-btn { flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
.quiz-completed { text-align: center; padding: 40px; background: #f9f9f9; border-radius: 8px; }
.quiz-completed h2 { color: #28a745; margin-bottom: 20px; }
.back-btn { margin-top: 20px; padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
</style>
