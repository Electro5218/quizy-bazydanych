<template>
  <div class="quiz-results-container">
    <div v-if="loading">Ładowanie wyników...</div>
    <div v-else>
      <div class="results-header">
        <h1>Wyniki quizu</h1>
        <button @click="router.push(`/group/${route.params.groupName}`)" class="back-btn">← Powrót</button>
      </div>

      <div class="quiz-info">
        <h2>{{ quizTitle }}</h2>
        <div class="stats">
          <div class="stat-box"><div class="stat-label">Uczestników</div><div class="stat-value">{{ attempts.length }}</div></div>
          <div class="stat-box"><div class="stat-label">Średni wynik</div><div class="stat-value">{{ avgScore }}%</div></div>
          <div class="stat-box"><div class="stat-label">Najwyższy</div><div class="stat-value">{{ maxScore }}%</div></div>
          <div class="stat-box"><div class="stat-label">Najniższy</div><div class="stat-value">{{ minScore }}%</div></div>
        </div>
      </div>

      <div class="results-list">
        <h3>Szczegółowe wyniki:</h3>
        <table class="results-table">
          <thead>
            <tr><th>Lp.</th><th>Użytkownik</th><th>Wynik</th><th>Procent</th><th>Status</th><th>Data</th></tr>
          </thead>
          <tbody>
            <tr v-for="(a, i) in attempts" :key="a.id">
              <td>{{ i + 1 }}</td>
              <td>{{ a.username || a.user_id }}</td>
              <td>{{ a.score ?? '-' }} / {{ a.total_questions }}</td>
              <td>
                <div class="score-badge" :class="pctClass(a)">
                  {{ a.total_questions ? Math.round((a.score/a.total_questions)*100) : '-' }}%
                </div>
              </td>
              <td>{{ a.status }}</td>
              <td>{{ a.started_at ? new Date(a.started_at).toLocaleString('pl-PL') : '-' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!attempts.length" class="no-content">Brak podejść do tego quizu.</p>
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
const loading = ref(true)
const attempts = ref([])
const quizTitle = ref('Quiz')

onMounted(async () => {
  try {
    const quizId = route.params.quizId
    const [attRes, quizRes] = await Promise.all([
      api.get(`/attempts?quiz_id=${quizId}`),
      api.get(`/quizzes/${quizId}`)
    ])
    attempts.value = attRes.data
    quizTitle.value = quizRes.data.title
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
})

function pct(a) {
  return a.total_questions ? Math.round((a.score / a.total_questions) * 100) : 0
}
function pctClass(a) {
  const p = pct(a)
  return p >= 70 ? 'high' : p >= 50 ? 'medium' : 'low'
}

const avgScore = computed(() => {
  if (!attempts.value.length) return 0
  return Math.round(attempts.value.reduce((s, a) => s + pct(a), 0) / attempts.value.length)
})
const maxScore = computed(() => attempts.value.length ? Math.max(...attempts.value.map(pct)) : 0)
const minScore = computed(() => attempts.value.length ? Math.min(...attempts.value.map(pct)) : 0)
</script>

<style scoped>
.quiz-results-container { max-width: 1000px; margin: 20px auto; padding: 20px; }
.results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
.back-btn { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
.quiz-info { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
.quiz-info h2 { margin-top: 0; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
.stat-box { background: white; padding: 15px; border-radius: 6px; text-align: center; border: 1px solid #ddd; }
.stat-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
.stat-value { font-size: 28px; font-weight: bold; color: #007bff; }
.results-list { background: white; padding: 20px; border-radius: 8px; }
.results-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.results-table th { padding: 12px; text-align: left; background: #f0f0f0; border-bottom: 2px solid #ddd; }
.results-table td { padding: 12px; border-bottom: 1px solid #eee; }
.score-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-weight: bold; color: white; }
.high { background: #28a745; }
.medium { background: #ffc107; color: #333; }
.low { background: #dc3545; }
.no-content { text-align: center; padding: 30px; color: #999; font-style: italic; }
</style>
