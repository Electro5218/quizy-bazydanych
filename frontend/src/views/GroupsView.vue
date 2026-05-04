<template>
  <div class="groups-container">
    <div class="header-actions">
      <h1>Grupy</h1>
      <button @click="goHome" class="home-btn">← Powrót do Home</button>
    </div>

    <div v-if="!user.isLogged" class="not-logged-in">
      <p>Musisz być zalogowany.</p>
      <button @click="router.push('/')">Zaloguj się</button>
    </div>

    <div v-else-if="user.role === 'instructor'" class="instruktor-view">
      <div class="create-group">
        <input v-model="newGroupName" placeholder="Nazwa nowej grupy" />
        <button @click="createGroup" class="create-btn">Stwórz grupę</button>
      </div>
      <p v-if="error" style="color:red">{{ error }}</p>
      <h3>Aktywne grupy:</h3>
      <ul class="groups-list">
        <li v-for="group in groups" :key="group.id" @click="openGroup(group)" class="group-item">
          <span>{{ group.name }}</span>
          <span class="code">Kod: {{ group.join_code }}</span>
          <button @click.stop="router.push('/add-quiz')" class="quiz-btn">Stwórz quiz</button>
        </li>
      </ul>
    </div>

    <div v-else class="uczen-view">
      <div class="join-group">
        <input v-model="groupCode" placeholder="Wpisz kod grupy" />
        <button @click="joinGroup" class="join-btn">Dołącz</button>
      </div>
      <p v-if="joinMsg" :style="{ color: joinMsg.startsWith('Błąd') ? 'red' : 'green' }">{{ joinMsg }}</p>
      <h3>Moje grupy:</h3>
      <ul class="groups-list">
        <li v-for="group in groups" :key="group.id" @click="openGroup(group)" class="group-item">
          <span>{{ group.name }}</span>
          <span class="status" :class="group.my_status">{{ group.my_status }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { user } from '../store/user.js'
import api from '../api/index.js'

const router = useRouter()
const newGroupName = ref('')
const groupCode = ref('')
const groups = ref([])
const error = ref('')
const joinMsg = ref('')

onMounted(async () => {
  try {
    const { data } = await api.get('/groups')
    groups.value = data
  } catch (err) {
    error.value = 'Błąd ładowania grup'
  }
})

async function createGroup() {
  if (!newGroupName.value) return
  try {
    const { data } = await api.post('/groups', { name: newGroupName.value })
    groups.value.unshift(data)
    newGroupName.value = ''
  } catch (err) {
    error.value = err.response?.data?.error || 'Błąd tworzenia grupy'
  }
}

async function joinGroup() {
  if (!groupCode.value) return
  try {
    await api.post('/groups/join', { join_code: groupCode.value })
    joinMsg.value = 'Prośba wysłana – czekaj na akceptację instruktora'
    groupCode.value = ''
    const { data } = await api.get('/groups')
    groups.value = data
  } catch (err) {
    joinMsg.value = 'Błąd: ' + (err.response?.data?.error || 'Nieprawidłowy kod')
  }
}

function openGroup(group) {
  router.push(`/group/${group.name}`)
}

function goHome() { router.push('/home') }
</script>

<style scoped>
.groups-container { max-width: 600px; margin: 50px auto; padding: 20px; }
.header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.home-btn { padding: 8px 16px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
.create-group, .join-group { margin-bottom: 20px; display: flex; gap: 10px; }
input { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
.create-btn, .join-btn { padding: 8px 16px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
.groups-list { list-style: none; padding: 0; }
.group-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 5px; cursor: pointer; }
.group-item:hover { background-color: #f8f9fa; }
.quiz-btn { padding: 5px 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
.code { font-size: 12px; color: #666; }
.status { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.accepted { background: #d4edda; color: #155724; }
.pending { background: #fff3cd; color: #856404; }
</style>
