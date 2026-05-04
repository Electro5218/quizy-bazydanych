<template>
  <div class="register-container">
    <h1>Rejestracja</h1>

    <div v-if="!registered" class="form">
      <div class="form-group">
        <input v-model="name" placeholder="Nazwa" />
      </div>

      <div class="form-group">
        <input v-model="email" placeholder="Adres email" type="email" />
      </div>

      <div class="form-group">
        <input v-model="password" placeholder="Hasło" type="password" />
      </div>

      <div class="form-group">
        <select v-model="role">
          <option value="uczen">Uczeń</option>
          <option value="instruktor">Instruktor</option>
        </select>
      </div>

      <button @click="register" class="register-btn">Zarejestruj</button>
    </div>

    <div v-else class="success">
      <p>Rejestracja zakończona pomyślnie!</p>
    </div>

    <button @click="goLogin" class="back-btn">Powrót do ekranu logowania</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const name = ref('')
const email = ref('')
const password = ref('')
const role = ref('uczen')
const registered = ref(false)

function register() {
  // For now, just show success message
  registered.value = true
}

function goLogin() {
  router.push('/')
}
</script>

<style scoped>
.register-container {
  max-width: 400px;
  margin: 50px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 15px;
}

input, select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.register-btn, .back-btn {
  width: 100%;
  padding: 10px;
  margin-top: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.register-btn {
  background-color: #28a745;
  color: white;
}

.back-btn {
  background-color: #6c757d;
  color: white;
}

.success {
  text-align: center;
  margin: 20px 0;
  color: #28a745;
  font-weight: bold;
}
</style>