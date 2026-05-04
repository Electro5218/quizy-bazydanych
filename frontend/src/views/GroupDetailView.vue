<template>
  <div class="group-container">
    <div v-if="loading">Ładowanie...</div>
    <div v-else>
      <div class="header">
        <h1>Grupa: {{ groupData?.name }}</h1>
        <button @click="router.push('/groups')" class="back-btn">← Powrót do grup</button>
      </div>

      <div v-if="user.role === 'instructor'" class="instruktor-view">
        <button @click="router.push('/add-quiz')" class="create-quiz-btn">+ Stwórz nowy quiz</button>
        <h3>Quizy w tej grupie:</h3>
        <div v-if="quizzes.length" class="quizzes-list">
          <div v-for="quiz in quizzes" :key="quiz.id" class="quiz-card">
            <div class="quiz-info">
              <h4>{{ quiz.title }}</h4>
              <p>Limit czasu: {{ quiz.time_limit_sec ? quiz.time_limit_sec/60 + ' min' : 'brak' }}</p>
              <p>Max prób: {{ quiz.max_attempts }}</p>
              <span class="badge" :class="quiz.is_draft ? 'draft' : 'active'">
                {{ quiz.is_draft ? 'Wersja robocza' : 'Aktywny' }}
              </span>
            </div>
            <button @click="router.push({ name: 'quiz-results', params: { groupName: route.params.name, quizId: quiz.id }})" class="view-results-btn">Wyniki</button>
          </div>
        </div>
        <p v-else class="no-content">Brak quizów. Stwórz nowy!</p>

        <h3>Członkowie grupy:</h3>
        <div v-if="members.length" class="members-list">
          <div v-for="m in members" :key="m.id" class="member-item">
            <span>{{ m.username }} ({{ m.first_name }} {{ m.last_name }})</span>
            <span class="status" :class="m.status">{{ m.status }}</span>
            <button v-if="m.status === 'pending'" @click="acceptMember(m.id)" class="accept-btn">Akceptuj</button>
          </div>
        </div>
      </div>

      <div v-else class="uczen-view">
        <h3>Dostępne quizy:</h3>
        <div v-if="quizzes.length" class="quizzes-list">
          <div v-for="quiz in quizzes" :key="quiz.id" class="quiz-card">
            <div class="quiz-info">
              <h4>{{ quiz.title }}</h4>
              <p>Czas: {{ quiz.time_limit_sec ? quiz.time_limit_sec/60 + ' min' : 'brak limitu' }}</p>
              <p>Twoje podejścia: {{ quiz.my_attempts }} / {{ quiz.max_attempts }}</p>
            </div>
            <button
              @click="startQuiz(quiz.id)"
              class="take-quiz-btn"
              :disabled="quiz.my_attempts >= quiz.max_attempts"
            >
              {{ quiz.my_attempts >= quiz.max_attempts ? 'Wyczerpano próby' : 'Rozwiąż quiz' }}
            </button>
          </div>
        </div>
        <p v-else class="no-content">Brak dostępnych quizów.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { user } from '../store/user.js'
import api from '../api/index.js'

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const groupData = ref(null)
const quizzes = ref([])
const members = ref([])

onMounted(async () => {
  try {
    const groups = await api.get('/groups')
    groupData.value = groups.data.find(g => g.name === route.params.name)
    if (groupData.value) {
      const detail = await api.get(`/groups/${groupData.value.id}`)
      members.value = detail.data.members || []
    }
    const qRes = await api.get('/quizzes')
    quizzes.value = qRes.data.filter(q => groupData.value && q.group_id === groupData.value.id)
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
})

async function acceptMember(userId) {
  try {
    await api.patch(`/groups/${groupData.value.id}/members/${userId}`, { status: 'accepted' })
    const m = members.value.find(m => m.id === userId)
    if (m) m.status = 'accepted'
  } catch (err) {
    console.error(err)
  }
}

function startQuiz(quizId) {
  router.push({ name: 'quiz-view', params: { groupName: route.params.name, quizId } })
}
</script>

<style scoped>
.group-container { max-width: 800px; margin: 20px auto; padding: 20px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
.back-btn { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
.create-quiz-btn { padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin-bottom: 20px; }
.quizzes-list { display: flex; flex-direction: column; gap: 15px; margin-bottom: 30px; }
.quiz-card { display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9; }
.quiz-info h4 { margin: 0 0 5px; }
.quiz-info p { margin: 3px 0; font-size: 14px; color: #666; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.draft { background: #fff3cd; color: #856404; }
.active { background: #d4edda; color: #155724; }
.take-quiz-btn, .view-results-btn { padding: 10px 20px; color: white; border: none; border-radius: 4px; cursor: pointer; }
.take-quiz-btn { background: #28a745; }
.take-quiz-btn:disabled { background: #aaa; cursor: not-allowed; }
.view-results-btn { background: #17a2b8; }
.members-list { display: flex; flex-direction: column; gap: 8px; }
.member-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid #eee; border-radius: 4px; }
.member-item span:first-child { flex: 1; }
.status { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.accepted { background: #d4edda; color: #155724; }
.pending { background: #fff3cd; color: #856404; }
.accept-btn { padding: 4px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
.no-content { text-align: center; padding: 30px; color: #999; font-style: italic; }
</style>
