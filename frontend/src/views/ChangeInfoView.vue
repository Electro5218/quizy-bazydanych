<template>
  <div class="change-container">
    <h1>Zmień dane konta</h1>

    <div class="form">
      <div class="form-group">
        <label>Email:</label>
        <input v-model="email" type="email" />
      </div>

      <div class="form-group">
        <label>Hasło:</label>
        <input v-model="password" type="password" />
      </div>

      <div class="form-group">
        <label>Nick:</label>
        <input v-model="nick" />
      </div>

      <div class="buttons">
        <button @click="save" class="save-btn">Zatwierdź</button>
        <button @click="goHome" class="back-btn">Powrót do Home</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('user@example.com') // Would come from store/user data
const password = ref('')
const nick = ref('UserNick') // Would come from store/user data

function save() {
  // For now, just show success
  alert('Dane zostały zapisane')
}

function goHome() {
  router.push('/home')
}
</script>

<style scoped>
.change-container {
  max-width: 400px;
  margin: 50px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.save-btn, .back-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn {
  background-color: #28a745;
  color: white;
}

.back-btn {
  background-color: #6c757d;
  color: white;
}
</style>