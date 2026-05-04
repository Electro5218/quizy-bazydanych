<template>
  <div class="groups-container">
    <div class="header-actions">
      <h1>Grupy</h1>
      <button @click="goHome" class="home-btn">← Powrót do Home</button>
    </div>

    <div v-if="!user.isLogged" class="not-logged-in">
      <p>Musisz być zalogowany, aby zobaczyć grupy.</p>
      <button @click="goLogin" class="login-btn">Przejdź do logowania</button>
    </div>

    <div v-else-if="user.role === 'instruktor'" class="instruktor-view">
      <div class="create-group">
        <input v-model="newGroupName" placeholder="Nazwa nowej grupy" />
        <button @click="createGroup" class="create-btn">Stwórz nową grupę</button>
      </div>

      <h3>Aktywne grupy:</h3>
      <ul class="groups-list">
        <li v-for="group in groups" :key="group" @click="openGroup(group)" class="group-item">
          {{ group }}
          <button @click.stop="createQuiz" class="quiz-btn">Stwórz quiz</button>
        </li>
      </ul>
    </div>

    <div v-else-if="user.role === 'uczen'" class="uczen-view">
      <div class="join-group">
        <input v-model="groupCode" placeholder="Wpisz kod grupy" />
        <button @click="joinGroup" class="join-btn">Dołącz</button>
      </div>

      <h3>Moje grupy:</h3>
      <ul class="groups-list">
        <li v-for="group in myGroups" :key="group" @click="openGroup(group)" class="group-item">
          {{ group }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { user } from '../store/user.js'

const router = useRouter()
const newGroupName = ref('')
const groupCode = ref('')
const groups = ref(['Matematyka', 'Fizyka', 'Chemia']) // Mock data
const myGroups = ref(['Matematyka', 'Fizyka']) // Mock data for uczen

function createGroup() {
  if (newGroupName.value) {
    groups.value.push(newGroupName.value)
    newGroupName.value = ''
  }
}

function joinGroup() {
  if (groupCode.value) {
    // Mock join
    myGroups.value.push(groupCode.value)
    groupCode.value = ''
  }
}

function openGroup(name) {
  router.push(`/group/${name}`)
}

function createQuiz() {
  router.push('/add-quiz')
}

function goLogin() {
  router.push('/')
}

function goHome() {
  router.push('/home')
}
</script>

<style scoped>
.groups-container {
  max-width: 600px;
  margin: 50px auto;
  padding: 20px;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.home-btn {
  padding: 8px 16px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.create-group, .join-group {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.create-btn, .join-btn {
  padding: 8px 16px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.groups-list {
  list-style: none;
  padding: 0;
}

.group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 5px;
  cursor: pointer;
}

.group-item:hover {
  background-color: #f8f9fa;
}

.quiz-btn {
  padding: 5px 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
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