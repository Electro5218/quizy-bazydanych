<template>
  <div class="reset-container">

    <!-- KROK 2: token w URL → formularz nowego hasła -->
    <div v-if="token">
      <h1>Nowe hasło</h1>
      <div v-if="!done" class="form">
        <div class="form-group">
          <label>Nowe hasło (min. 8 znaków):</label>
          <input v-model="newPassword" type="password" placeholder="Nowe hasło" />
        </div>
        <div class="form-group">
          <label>Potwierdź hasło:</label>
          <input v-model="confirmPassword" type="password" placeholder="Powtórz hasło" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button @click="submitNewPassword" class="reset-btn">Ustaw nowe hasło</button>
      </div>
      <div v-else class="success">
        <p>Hasło zostało zmienione. Możesz się teraz zalogować.</p>
      </div>
    </div>

    <!-- KROK 1: podaj email -->
    <div v-else>
      <h1>Reset hasła</h1>
      <div v-if="!emailSent" class="form">
        <div class="form-group">
          <input v-model="email" placeholder="Adres email" type="email" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button @click="requestReset" class="reset-btn">Wyślij link resetujący</button>
      </div>
      <div v-else class="success">
        <p>Jeśli konto o podanym adresie istnieje, wysłaliśmy link do resetu hasła.</p>
      </div>
    </div>

    <button @click="router.push('/')" class="back-btn">Powrót do logowania</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api/index.js'

const router = useRouter()
const route = useRoute()

const token = ref('')
const email = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const emailSent = ref(false)
const done = ref(false)
const error = ref('')

onMounted(() => {
  token.value = route.query.token || ''
})

async function requestReset() {
  error.value = ''
  if (!email.value.trim()) return (error.value = 'Podaj adres email')
  try {
    await api.post('/auth/forgot-password', { email: email.value.trim() })
    emailSent.value = true
  } catch {
    emailSent.value = true // zawsze pokazuj ten sam komunikat (brak enumeracji)
  }
}

async function submitNewPassword() {
  error.value = ''
  if (newPassword.value.length < 8) return (error.value = 'Hasło musi mieć minimum 8 znaków')
  if (newPassword.value !== confirmPassword.value) return (error.value = 'Hasła nie są identyczne')
  try {
    await api.post('/auth/reset-password', { token: token.value, password: newPassword.value })
    done.value = true
  } catch (err) {
    error.value = err.response?.data?.error || 'Błąd resetowania hasła — link mógł wygasnąć'
  }
}
</script>

<style scoped>
.reset-container { max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px; }
h1 { margin-bottom: 20px; }
.form-group { margin-bottom: 14px; }
label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; }
input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
.reset-btn, .back-btn { width: 100%; padding: 10px; margin-top: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; }
.reset-btn { background: #007bff; color: white; }
.back-btn { background: #6c757d; color: white; }
.success { text-align: center; margin: 20px 0; color: #28a745; font-weight: bold; }
.error { color: #dc3545; margin: 6px 0; font-size: 14px; }
</style>
