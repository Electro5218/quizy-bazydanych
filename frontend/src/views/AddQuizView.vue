<template>
  <div class="quiz-container">
    <h1>Dodaj quiz</h1>

    <div class="quiz-form">
      <!-- Podstawowe ustawienia -->
      <div class="form-group">
        <label>Nazwa quizu:</label>
        <input v-model="quiz.title" placeholder="np. Kolokwium 1 - Podstawy SQL" />
      </div>
      <div class="form-group publish-row">
        <label class="publish-label">
          <input type="checkbox" v-model="quiz.publish" />
          Opublikuj od razu (odznacz aby zapisać jako wersję roboczą)
        </label>
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

      <!-- Tryb pytań -->
      <div class="mode-toggle">
        <label>Źródło pytań:</label>
        <div class="toggle-btns">
          <button :class="['mode-btn', { active: mode === 'manual' }]" @click="mode = 'manual'">
            Ręczne pytania
          </button>
          <button :class="['mode-btn', { active: mode === 'pool' }]" @click="mode = 'pool'">
            Pula pytań
          </button>
        </div>
      </div>

      <!-- TRYB: Pula pytań -->
      <div v-if="mode === 'pool'" class="pool-mode">
        <div class="form-row">
          <div class="form-group">
            <label>Wybierz pulę:</label>
            <select v-model="quiz.question_pool_id">
              <option value="">-- wybierz pulę --</option>
              <option v-for="p in pools" :key="p.id" :value="p.id">
                {{ p.name }} ({{ p.question_count }} pytań)
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Liczba losowanych pytań (0 = wszystkie):</label>
            <input v-model.number="quiz.draw_count" type="number" min="0" />
          </div>
        </div>
        <div v-if="selectedPool" class="pool-info">
          <span class="pool-badge">{{ selectedPool.name }}</span>
          Każdy student dostanie
          <strong>{{ quiz.draw_count > 0 ? quiz.draw_count : selectedPool.question_count }}</strong>
          pytań w innej, losowej kolejności.
        </div>
        <p class="pool-hint">
          Nie masz puli?
          <a href="#" @click.prevent="router.push('/pools')">Zarządzaj pulami pytań →</a>
        </p>
      </div>

      <!-- TRYB: Ręczne pytania -->
      <div v-if="mode === 'manual'" class="questions-section">
        <h3>Pytania</h3>
        <p class="mode-hint">Pytania będą losowo przetasowane dla każdego studenta.</p>
        <div v-for="(question, index) in quiz.questions" :key="index" class="question">
          <div class="question-header">
            <span class="q-number">Pytanie {{ index + 1 }}</span>
            <select v-model="question.question_type">
              <option value="single">Jednokrotny wybór</option>
              <option value="multiple">Wielokrotny wybór</option>
            </select>
            <button @click="removeQuestion(index)" class="remove-btn">Usuń</button>
          </div>
          <div class="form-group">
            <label>Treść pytania:</label>
            <textarea v-model="question.content" rows="2"></textarea>
          </div>
          <div class="answers">
            <label>Odpowiedzi:</label>
            <div v-for="(answer, ansIndex) in question.answers" :key="ansIndex" class="answer">
              <input v-model="answer.content" placeholder="Treść odpowiedzi" class="ans-input" />
              <label class="correct-label">
                <input v-model="answer.is_correct" type="checkbox" />
                Poprawna
              </label>
              <button @click="question.answers.splice(ansIndex, 1)" class="remove-btn small">✕</button>
            </div>
            <button @click="question.answers.push({ content: '', is_correct: false })" class="add-btn">
              + Odpowiedź
            </button>
          </div>
        </div>
        <button @click="addQuestion" class="add-question-btn">+ Dodaj pytanie</button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">{{ success }}</p>

      <div class="buttons">
        <button @click="saveQuiz" class="save-btn">Zapisz quiz</button>
        <button @click="router.push('/groups')" class="back-btn">Powrót</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api/index.js'

const router = useRouter()
const route = useRoute()
const groupId = route.query.group_id ? parseInt(route.query.group_id) : null

const error = ref('')
const success = ref('')
const mode = ref('manual')
const pools = ref([])

const quiz = ref({
  title: '',
  max_attempts: 1,
  timeLimit: 30,
  visible_from: '',
  visible_until: '',
  question_pool_id: '',
  draw_count: 0,
  publish: true,
  questions: []
})

const selectedPool = computed(() =>
  pools.value.find(p => p.id === quiz.value.question_pool_id) || null
)

onMounted(async () => {
  try {
    const { data } = await api.get('/pools')
    pools.value = data
  } catch {
    /* ignore - user may have no pools yet */
  }
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

  if (mode.value === 'pool') {
    if (!quiz.value.question_pool_id) return (error.value = 'Wybierz pulę pytań')
  } else {
    if (!quiz.value.questions.length) return (error.value = 'Dodaj co najmniej jedno pytanie')
    for (const q of quiz.value.questions) {
      if (!q.content.trim()) return (error.value = 'Każde pytanie musi mieć treść')
      if (q.answers.length < 2) return (error.value = 'Każde pytanie musi mieć co najmniej 2 odpowiedzi')
      if (!q.answers.some(a => a.is_correct)) return (error.value = 'Każde pytanie musi mieć co najmniej 1 poprawną odpowiedź')
    }
  }

  try {
    const payload = {
      title: quiz.value.title,
      group_id: groupId,
      max_attempts: quiz.value.max_attempts,
      time_limit_sec: quiz.value.timeLimit ? quiz.value.timeLimit * 60 : null,
      visible_from: quiz.value.visible_from || null,
      visible_until: quiz.value.visible_until || null,
      is_draft: !quiz.value.publish
    }

    if (mode.value === 'pool') {
      payload.question_pool_id = quiz.value.question_pool_id
      payload.draw_count = quiz.value.draw_count > 0 ? quiz.value.draw_count : null
    }

    const { data: newQuiz } = await api.post('/quizzes', payload)

    if (mode.value === 'manual') {
      for (const q of quiz.value.questions) {
        const { data: newQ } = await api.post('/questions', {
          content: q.content,
          question_type: q.question_type,
          answers: q.answers
        })
        await api.post(`/quizzes/${newQuiz.id}/questions`, { question_id: newQ.id })
      }
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
.form-row { display: flex; gap: 15px; flex-wrap: wrap; }
.form-row .form-group { flex: 1; min-width: 200px; }
label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; }
input, textarea, select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
textarea { min-height: 60px; resize: vertical; }

.mode-toggle { margin: 20px 0 16px; }
.mode-toggle > label { margin-bottom: 8px; }
.toggle-btns { display: flex; gap: 0; }
.mode-btn { flex: 1; padding: 10px; border: 2px solid #dee2e6; background: white; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s; }
.mode-btn:first-child { border-radius: 6px 0 0 6px; }
.mode-btn:last-child { border-radius: 0 6px 6px 0; border-left: none; }
.mode-btn.active { background: #007bff; color: white; border-color: #007bff; }

.pool-mode { background: #f0f7ff; border: 1px solid #b8d9f8; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
.pool-info { margin-top: 10px; font-size: 14px; color: #333; padding: 8px 12px; background: #dbeeff; border-radius: 4px; }
.pool-badge { display: inline-block; background: #007bff; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-right: 6px; }
.pool-hint { margin-top: 10px; font-size: 13px; color: #555; }
.pool-hint a { color: #007bff; }
.mode-hint { font-size: 13px; color: #666; margin-bottom: 12px; }

.questions-section { margin-bottom: 20px; }
.questions-section h3 { margin-bottom: 4px; }
.question { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #fafafa; }
.question-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.q-number { font-weight: bold; font-size: 13px; color: #666; }
.question-header select { flex: 1; }
.answers { margin-top: 10px; }
.answer { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.ans-input { flex: 1; }
.correct-label { display: flex; align-items: center; gap: 4px; white-space: nowrap; font-weight: normal; font-size: 13px; }
.correct-label input { width: auto; }
.add-btn { padding: 5px 12px; border: 1px dashed #007bff; background: white; color: #007bff; border-radius: 4px; cursor: pointer; margin-top: 4px; }
.remove-btn { padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; }
.remove-btn.small { padding: 3px 8px; font-size: 12px; }
.add-question-btn { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; font-size: 15px; }
.buttons { display: flex; gap: 10px; margin-top: 10px; }
.save-btn, .back-btn { flex: 1; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 600; }
.save-btn { background: #28a745; color: white; }
.back-btn { background: #6c757d; color: white; }
.error { color: #dc3545; margin: 8px 0; }
.success { color: #28a745; margin: 8px 0; }
</style>
