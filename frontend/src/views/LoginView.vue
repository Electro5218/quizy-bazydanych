<template>
  <div class="login-container">
    <h1>Login</h1>

    <div class="form">
      <div class="form-group">
        <input v-model="email" placeholder="Email" type="email" />
      </div>

      <div class="form-group">
        <input v-model="password" placeholder="Hasło" type="password" />
      </div>

      <div class="form-group">
        <label>Typ profilu:</label>
        <select v-model="profileType">
          <option value="uczen">Uczeń</option>
          <option value="instruktor">Instruktor</option>
        </select>
      </div>

      <button @click="handleLogin" class="login-btn">Zaloguj</button>

      <div class="links">
        <button @click="goRegister" class="link-btn">Nie mam jeszcze konta</button>
        <button @click="goReset" class="link-btn">Reset hasła</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import * as userStore from '../store/user.js'

const router = useRouter()
const email = ref('')
const password = ref('')
const profileType = ref('uczen')

function handleLogin() {
  // For now, just login with the selected role
  userStore.login(profileType.value)
  router.push('/home')
}

function goRegister() {
  router.push('/register')
}

function goReset() {
  router.push('/reset')
}
</script>

<style scoped>
.login-container {
  max-width: 500px;
  margin: 20px auto;
  padding: 20px;
}

.form {
  background-color: white;
  padding: 30px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 30px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  font-size: 14px;
}

input, select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.login-btn {
  width: 100%;
  padding: 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
}

.login-btn:hover {
  background-color: #0056b3;
}

.links {
  margin-top: 15px;
  text-align: center;
}

.link-btn {
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  text-decoration: underline;
  margin: 0 10px;
  font-size: 14px;
}
</style>