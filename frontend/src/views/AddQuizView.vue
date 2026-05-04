<template>
  <div class="quiz-container">
    <h1>Dodaj quiz</h1>
    <div class="quiz-form">
      <div class="form-group">
        <label>Nazwa quizu:</label>
        <input v-model="quiz.title" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Liczba prób:</label>
          <input v-model.number="quiz.max_attempts" type="number" min="1" />
        </div>
        <div class="form-group">
          <label>Czas (minuty, 0 = bez limitu):</label>
          <input v-model.number="quiz.timeLimit" type="number" min="0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Widoczny od:</label>
          <input v-model="quiz.visible_from" type="datetime-local" />
        </div>
        <div class="form-group">
          <label>Widoczny do:</label>
          <input v-model="quiz.visible_until" type="datetime-local" />
        </div>
      </div>
      <div class="questions-section">
        <h3>Pytania</h3>
        <div v-for="(question, index) in quiz.questions" :key="index" class="question">
          <div class="question-header">
            <select v-model="question.question_type">
              <option value="single">Jednokrotny wybór</option>
              <option value="multiple">Wielokrotny wybór</option>
            </select>
            <button @click="removeQuestion(index)" class="remove-btn">Usuń</button>
          </div>
          <div class="form-group">
            <label>Treść pytania:</label>
            <textarea v-model="question.content"></textarea>
          </div>
          <div class="answers">
            <label>Odpowiedzi:</label>
            <div v-for="(answer, ansIndex) in question.answers" :key="ansIndex" class="answer">
              <input v-model="answer.content" placeholder="Treść odpowiedzi" />
              <input v-model="answer.is_correct" type="checkbox" />
              <label>Poprawna</label>
              <button @click="question.answers.splice(ansIndex, 1)" class="remove-btn">X</button>
            </div>
            <button @click="question.answers.push({ content: '', is_correct: false })" class="add-btn">Dodaj odpowiedź</button>
          </div>
        </div>
        <button @click="addQuestion" class="add-question-btn">+ Dodaj pytanie</button>
      </div>
      <p v-if="error" style="color:red">{{ error }}</p>
      <p v-if="success" style="color:green">{{ success }}</p>
      <div class="buttons">
        <button @click="saveQuiz" class="save-btn">Zapisz quiz</button>
        <button @click="router.push('/groups')" class="back-btn">Powrót</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/index.js'

const router = useRouter()
const error = ref('')
const success = ref('')

const quiz = ref({
  title: '',
  max_attempts: 1,
  timeLimit: 30,
  visible_from: '',
  visible_until: '',
  questions: []
})

function addQuestion() {
  quiz.value.questions.push({
    question_type: 'single',
    content: '',
    answers: [
      { content: '', is_correct: false },
      { content: '', is_correct: false }
    ]
  })
}

function removeQuestion(index) {
  quiz.value.questions.splice(index, 1)
}

async function saveQuiz() {
  error.value = ''
  success.value = ''
  if (!quiz.value.title) return (error.value = 'Podaj nazwę quizu')
  if (!quiz.value.questions.length) return (error.value = 'Dodaj co najmniej jedno pytanie')

  try {
    // 1. Utwórz quiz
    const { data: newQuiz } = await api.post('/quizzes', {
      title: quiz.value.title,
      max_attempts: quiz.value.max_attempts,
      time_limit_sec: quiz.value.timeLimit ? quiz.value.timeLimit * 60 : null,
      visible_from: quiz.value.visible_from || null,
      visible_until: quiz.value.visible_until || null
    })

    // 2. Utwórz pytania i dodaj do quizu
    for (const q of quiz.value.questions) {
      const { data: newQ } = await api.post('/questions', {
        content: q.content,
        question_type: q.question_type,
        answers: q.answers
      })
      await api.post(`/quizzes/${newQuiz.id}/questions`, {
        question_id: newQ.id
      })
    }

    success.value = 'Quiz zapisany pomyślnie!'
    setTimeout(() => router.push('/groups'), 1500)
  } catch (err) {
    error.value = err.response?.data?.error || 'Błąd zapisu quizu'
  }
}
</script>

<style scoped>
.quiz-container { max-width: 800px; margin: 20px auto; padding: 20px; }
.form-group { margin-bottom: 15px; }
.form-row { display: flex; gap: 15px; }
.form-row .form-group { flex: 1; }
label { display: block; margin-bottom: 5px; font-weight: bold; }
input, textarea, select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
textarea { min-height: 60px; }
.question { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
.question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.answers { margin-top: 10px; }
.answer { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
.answer input[type="text"] { flex: 1; }
.add-btn, .remove-btn { padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; }
.add-btn { background-color: #28a745; color: white; }
.remove-btn { background-color: #dc3545; color: white; }
.add-question-btn { width: 100%; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
.buttons { display: flex; gap: 10px; margin-top: 30px; }
.save-btn, .back-btn { flex: 1; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
.save-btn { background-color: #28a745; color: white; }
.back-btn { background-color: #6c757d; color: white; }
</style>
