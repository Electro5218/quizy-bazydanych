<template>
  <div class="login-container">
    <h1>Login</h1>
    <div class="form">
      <div class="form-group">
        <input v-model="email" placeholder="Email" type="email" />
      </div>
      <div class="form-group">
        <input v-model="password" placeholder="Haslo" type="password" />
      </div>
      <p v-if="error" style="color:red">{{ error }}</p>
      <button @click="handleLogin" class="login-btn">Zaloguj</button>
      <div class="links">
        <button @click="goRegister" class="link-btn">Nie mam jeszcze konta</button>
        <button @click="goReset" class="link-btn">Reset hasla</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/index.js'
import * as userStore from '../store/user.js'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')

async function handleLogin() {
  error.value = ''
  try {
    const { data } = await api.post('/auth/login', {
      email: email.value,
      password: password.value
    })
    localStorage.setItem('token', data.token)
    userStore.login(data.user.role)
    router.push('/home')
  } catch (err) {
    error.value = err.response?.data?.error || 'Blad logowania'
  }
}

function goRegister() { router.push('/register') }
function goReset() { router.push('/reset') }
</script>

<style scoped>
.login-container { max-width: 500px; margin: 20px auto; padding: 20px; }
.form { background-color: white; padding: 30px; border: 1px solid #ddd; border-radius: 8px; }
.form-group { margin-bottom: 15px; }
input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
.login-btn { width: 100%; padding: 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; }
.links { margin-top: 15px; text-align: center; }
.link-btn { background: none; border: none; color: #007bff; cursor: pointer; text-decoration: underline; margin: 0 10px; }
</style>