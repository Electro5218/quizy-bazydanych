<template>
  <div class="delete-container">
    <h1>Usuń konto</h1>

    <div v-if="user.role === 'uczen'" class="uczen-view">
      <button @click="showConfirmation" class="delete-btn">Usuń konto</button>

      <div v-if="showConfirm" class="confirmation">
        <p>Usunięcie konta jest nieodwracalne. Czy na pewno chcesz usunąć konto?</p>
        <button @click="confirmDelete" class="confirm-btn">Tak</button>
        <button @click="cancelDelete" class="cancel-btn">Nie</button>
      </div>
    </div>

    <div v-if="user.role === 'instruktor'" class="instruktor-view">
      <div class="info">
        <h3>Aktywne kursy i quizy:</h3>
        <ul>
          <li>Kurs Matematyka - 15 uczniów</li>
          <li>Quiz Fizyka - 20 pytań</li>
          <li>Kurs Chemia - 8 uczniów</li>
        </ul>
        <p>Uwaga: Usunięcie konta spowoduje usunięcie wszystkich powiązanych kursów i quizów.</p>
      </div>

      <button @click="showConfirmation" class="delete-btn">Usuń konto</button>

      <div v-if="showConfirm" class="confirmation">
        <p>Usunięcie konta jest nieodwracalne. Czy na pewno chcesz usunąć konto?</p>
        <button @click="confirmDelete" class="confirm-btn">Tak</button>
        <button @click="cancelDelete" class="cancel-btn">Nie</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { user, logout } from '../store/user.js'

const router = useRouter()
const showConfirm = ref(false)

function showConfirmation() {
  showConfirm.value = true
}

function confirmDelete() {
  // For now, just logout and go to login
  logout()
  router.push('/')
}

function cancelDelete() {
  showConfirm.value = false
}
</script>

<style scoped>
.delete-container {
  max-width: 600px;
  margin: 50px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.delete-btn {
  padding: 10px 20px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin: 20px 0;
}

.confirmation {
  margin-top: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.confirm-btn, .cancel-btn {
  padding: 8px 16px;
  margin: 0 5px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-btn {
  background-color: #dc3545;
  color: white;
}

.cancel-btn {
  background-color: #6c757d;
  color: white;
}

.info {
  margin-bottom: 20px;
}

ul {
  margin: 10px 0;
  padding-left: 20px;
}
</style>